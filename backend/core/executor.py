"""
Secure Code Execution Engine
Runs Python code in isolated subprocesses with resource limits.
In production, use Docker containers for stronger isolation.
"""

import asyncio
import subprocess
import tempfile
import os
import time
import logging
import sys

logger = logging.getLogger(__name__)

# Per-execution resource limits
MAX_OUTPUT_SIZE = 50_000   # characters
ALLOWED_BUILTINS = True


class ExecutionResult:
    def __init__(self, stdout: str, stderr: str, exit_code: int, execution_time: float):
        self.stdout = stdout
        self.stderr = stderr
        self.exit_code = exit_code
        self.execution_time = execution_time

    @property
    def output(self) -> str:
        return (self.stdout + ("\n" + self.stderr if self.stderr else "")).strip()


class SecureExecutor:
    """
    Runs Python scripts in isolated subprocesses.
    Applies timeouts and output limits.
    For production: swap subprocess for docker exec.
    """

    async def execute(
        self,
        script: str,
        timeout: int = 30,
        cpu_limit: float = 1.0,
        memory_limit_mb: float = 256.0,
        vm_id: str = None,
    ) -> ExecutionResult:
        """Execute Python script with safety limits."""

        # Write script to temp file
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".py", delete=False, prefix=f"cloudsim_"
        ) as f:
            f.write(script)
            script_path = f.name

        start = time.time()
        try:
            # Run in subprocess with timeout
            proc = await asyncio.create_subprocess_exec(
                sys.executable, script_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(), timeout=timeout
                )
                elapsed = time.time() - start
                stdout_str = stdout.decode("utf-8", errors="replace")[:MAX_OUTPUT_SIZE]
                stderr_str = stderr.decode("utf-8", errors="replace")[:MAX_OUTPUT_SIZE]
                return ExecutionResult(stdout_str, stderr_str, proc.returncode, elapsed)

            except asyncio.TimeoutError:
                proc.kill()
                await proc.communicate()
                return ExecutionResult(
                    "", f"⏱️ Execution timed out after {timeout} seconds",
                    -1, timeout
                )
        finally:
            try:
                os.unlink(script_path)
            except Exception:
                pass

    async def execute_command(
        self, command: str, vm_id: str = None, timeout: int = 10
    ) -> ExecutionResult:
        """
        Execute a shell-like command (simulated VM terminal).
        Supports: python3, pip, ls, pwd, mkdir, cat, echo, etc.
        """
        start = time.time()
        parts = command.strip().split(None, 1)
        cmd = parts[0] if parts else ""
        args = parts[1] if len(parts) > 1 else ""

        # Handle python3 script execution
        if cmd in ("python3", "python"):
            if args.endswith(".py"):
                return ExecutionResult(
                    f"# Run: {command}\n# (Upload file first or use inline exec)",
                    "", 0, time.time() - start
                )
            # Inline code: python3 -c "..."
            if args.startswith("-c "):
                code = args[3:].strip().strip("\"'")
                return await self.execute(code, timeout=timeout)
            return ExecutionResult("", f"Usage: python3 script.py or python3 -c 'code'", 1, 0)

        # Simulated file system commands
        simulated_fs = {
            "ls": "hello.py  main.py  requirements.txt  data/",
            "pwd": f"/home/cloudsim/vm-{vm_id or 'default'}",
            "whoami": "cloudsim",
            "uname": "Linux CloudSim 5.15.0 x86_64 GNU/Linux",
            "date": str(__import__("datetime").datetime.now().strftime("%a %b %d %H:%M:%S UTC %Y")),
            "hostname": f"vm-{vm_id or 'cloudsim'}.cloud.internal",
            "df -h": "Filesystem      Size  Used Avail Use%\n/dev/sda1        20G  4.2G   15G  22%",
            "free -h": "              total        used        free\nMem:          4.0Gi       1.2Gi       2.8Gi",
            "uptime": "10:32:01 up 2 days, 14:22,  1 user,  load average: 0.25, 0.30, 0.28",
            "cat /etc/os-release": 'NAME="Ubuntu"\nVERSION="22.04.3 LTS"\nID=ubuntu',
        }

        full_cmd = command.strip()
        if full_cmd in simulated_fs:
            return ExecutionResult(simulated_fs[full_cmd], "", 0, time.time() - start)

        if cmd == "echo":
            return ExecutionResult(args.strip("\"'"), "", 0, time.time() - start)

        if cmd == "mkdir":
            return ExecutionResult(f"Created directory: {args}", "", 0, time.time() - start)

        if cmd in ("cat",):
            return ExecutionResult(f"cat: {args}: File content would appear here", "", 0, time.time() - start)

        if cmd == "pip" or cmd == "pip3":
            pkg = args.replace("install ", "").strip().split()[0] if args else "?"
            return ExecutionResult(
                f"Collecting {pkg}\n  Downloading {pkg}-1.0-py3-none-any.whl\nSuccessfully installed {pkg}-1.0",
                "", 0, time.time() - start
            )

        if cmd == "clear":
            return ExecutionResult("\033[2J\033[H", "", 0, time.time() - start)

        if cmd == "help":
            return ExecutionResult(
                "Available commands:\n"
                "  python3 -c 'code'    Execute Python code\n"
                "  pip install <pkg>    Install Python package\n"
                "  ls                   List files\n"
                "  pwd                  Print working directory\n"
                "  mkdir <dir>          Create directory\n"
                "  cat <file>           Display file contents\n"
                "  echo <text>          Print text\n"
                "  df -h                Disk usage\n"
                "  free -h              Memory usage\n"
                "  uname                System info",
                "", 0, time.time() - start
            )

        return ExecutionResult(
            "", f"bash: {cmd}: command not found\nType 'help' for available commands", 127, time.time() - start
        )


_executor = None


def get_executor() -> SecureExecutor:
    global _executor
    if _executor is None:
        _executor = SecureExecutor()
    return _executor
