from enum import Enum
from datetime import datetime


class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class Task:
    def __init__(self, id, name, stages):
        self.id = id
        self.name = name
        self.status = TaskStatus.PENDING
        self.created_at = datetime.now().isoformat()
        self.started_at = None
        self.completed_at = None
        self.error = None
        self._cancelled = False
        self.stage = None
        self.progress = 0
        self.logs = []
        self.stages = stages

    def feedLog(self, log):
        self.logs.append(log)

    def start(self):
        self.started_at = datetime.now().isoformat()
        self.status = TaskStatus.RUNNING
        self.progress = 0
        self.stage = "starting"
        self.logs = []

    def complete(self):
        self.completed_at = datetime.now().isoformat()
        self.status = TaskStatus.COMPLETED
        self.progress = 100
        self.stage = None

    def cancel(self):
        self._cancelled = True
        self.status = TaskStatus.CANCELLED
        self.stage = None
    
    def is_cancelled(self):
        return self._cancelled

    def update_progress(self, stage, current_step, total_steps):
        progress = 0
        for s in self.stages:
            if s[0] == stage:
                progress += s[1] * current_step / total_steps
                break
            else:
                progress += s[1]

        self.progress = progress
        self.stage = stage

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "error": self.error,
            "progress": self.progress,
            "stage": self.stage,
            "logs": self.logs
        }
