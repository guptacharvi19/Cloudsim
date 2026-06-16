"""Terminal WebSocket API router."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import json

from core.database import get_db
from core.executor import get_executor
from models.schemas import TerminalCommand, TerminalResponse
from models.orm_models import VM

router = APIRouter()


@router.post("/execute", response_model=TerminalResponse)
async def execute_command(
    payload: TerminalCommand,
    db: AsyncSession = Depends(get_db),
):
    """Execute a command in a VM's terminal."""
    vm = await db.get(VM, payload.vm_id)
    if not vm:
        return TerminalResponse(output="Error: VM not found", exit_code=1, execution_time=0)

    if vm.status != "running":
        return TerminalResponse(
            output=f"Error: VM '{vm.name}' is not running (status: {vm.status})",
            exit_code=1, execution_time=0
        )

    executor = get_executor()
    result = await executor.execute_command(payload.command, vm_id=payload.vm_id)

    return TerminalResponse(
        output=result.output,
        exit_code=result.exit_code,
        execution_time=round(result.execution_time, 3),
    )


@router.websocket("/ws/{vm_id}")
async def terminal_websocket(websocket: WebSocket, vm_id: str):
    """WebSocket endpoint for real-time terminal access."""
    await websocket.accept()
    executor = get_executor()

    # Send welcome banner
    await websocket.send_json({
        "type": "output",
        "data": f"\r\n\033[32mCloudSim Terminal\033[0m — VM: {vm_id}\r\n"
                f"Type 'help' for available commands.\r\n\n"
    })

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            command = msg.get("command", "").strip()

            if not command:
                continue

            result = await executor.execute_command(command, vm_id=vm_id)
            output = result.output if result.output else ""

            await websocket.send_json({
                "type": "output",
                "data": output + ("\r\n" if not output.endswith("\n") else ""),
                "exit_code": result.exit_code,
                "execution_time": round(result.execution_time, 3),
            })
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "data": str(e)})
        except Exception:
            pass
