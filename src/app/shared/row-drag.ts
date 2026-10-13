/** Native row dragging keeps table layout and editable Material controls intact. */
export class RowDrag {
  id: number | null = null;
  target: number | null = null;
  private cleanup: (() => void) | null = null;
  constructor(private kind: string) {}
  pointerStart(
    event: PointerEvent,
    id: number,
    disabled: boolean,
    drop: (id: number, parentId: number | null, projectId: number | null) => void,
    changed: () => void,
  ) {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.cleanup?.();
    this.id = id;
    const find = (e: PointerEvent) =>
      document
        .elementsFromPoint(e.clientX, e.clientY)
        .map((element) =>
          element.closest<HTMLElement>('[data-hierarchy-row],[data-hierarchy-project]'),
        )
        .find((element) => element !== null);
    const move = (e: PointerEvent) => {
      const target = find(e);
      this.target = target?.dataset['hierarchyRow'] ? Number(target.dataset['hierarchyRow']) : null;
      changed();
    };
    const finish = (e: PointerEvent) => {
      const target = find(e);
      const row = target?.dataset['hierarchyRow'];
      const project = target?.dataset['hierarchyProject'];
      this.end();
      changed();
      if (row && Number(row) !== id) drop(id, Number(row), null);
      else if (project !== undefined) drop(id, null, project === 'none' ? null : Number(project));
    };
    const cancel = () => {
      this.end();
      changed();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', finish, { once: true });
    document.addEventListener('pointercancel', cancel, { once: true });
    this.cleanup = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', finish);
      document.removeEventListener('pointercancel', cancel);
      this.cleanup = null;
    };
    changed();
  }
  start(event: DragEvent, id: number, disabled: boolean) {
    const element = event.target as HTMLElement;
    if (disabled || element.closest('input,select,textarea,button,[role="button"],mat-select')) {
      event.preventDefault();
      return;
    }
    this.id = id;
    event.dataTransfer?.setData(`application/x-${this.kind}-row`, String(id));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }
  over(event: DragEvent, target: number | null) {
    if (this.id === null || this.id === target) return;
    event.preventDefault();
    this.target = target;
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }
  take(event: DragEvent): number | null {
    event.preventDefault();
    event.stopPropagation();
    const id = this.id;
    this.end();
    return id;
  }
  end() {
    this.cleanup?.();
    this.id = null;
    this.target = null;
  }
}
