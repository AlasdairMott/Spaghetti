import type { StateCreator } from "zustand";
import type { Module, PanelComponent, ComponentKind, GridPosition, Tool, ConnectionKind, MmPoint, Connection, PanelRect } from "../models/types";
import type { AppStore } from "./index";

const MAX_HISTORY = 100;

export interface EditorSlice {
  editingModule: Module | null;
  activeTool: Tool;
  selectedComponentId: string | null;
  selectedComponentIds: string[];
  selectedConnectionId: string | null;
  selectedRectId: string | null;
  _history: Module[];
  _future: Module[];

  openModuleForEditing: (module: Module) => void;
  createNewModule: (name: string, widthHP: number) => void;
  closeEditor: () => void;

  setActiveTool: (tool: Tool) => void;
  selectComponent: (id: string | null) => void;
  selectComponents: (ids: string[]) => void;
  selectConnection: (id: string | null) => void;
  selectRect: (id: string | null) => void;

  addRect: (from: MmPoint, to: MmPoint) => void;
  updateRect: (id: string, updates: Partial<PanelRect>) => void;
  removeRect: (id: string) => void;

  updateModuleName: (name: string) => void;
  updateModuleWidth: (widthHP: number) => void;
  updateModuleTags: (tags: string[]) => void;

  addComponent: (kind: ComponentKind, position: GridPosition) => void;
  updateComponent: (id: string, updates: Partial<PanelComponent>) => void;
  updateComponents: (ids: string[], updates: Partial<PanelComponent>) => void;
  removeComponent: (id: string) => void;
  removeComponents: (ids: string[]) => void;
  moveComponent: (id: string, position: GridPosition) => void;
  moveComponentsByDelta: (ids: string[], deltaX: number, deltaY: number) => void;
  duplicateComponent: (id: string) => string | null;
  pushSnapshot: () => void;

  updateModuleCode: (code: string) => void;

  addConnection: (kind: ConnectionKind, from: MmPoint, to: MmPoint, startOffset?: number, endOffset?: number) => void;
  updateConnection: (id: string, updates: Partial<Connection>) => void;
  removeConnection: (id: string) => void;

  undo: () => void;
  redo: () => void;
}

/** Push current editingModule onto history, clear future */
function pushHistory(state: AppStore): { _history: Module[]; _future: Module[] } {
  if (!state.editingModule) return { _history: state._history, _future: [] };
  const snapshot = JSON.parse(JSON.stringify(state.editingModule));
  const history = [...state._history, snapshot];
  if (history.length > MAX_HISTORY) history.shift();
  return { _history: history, _future: [] };
}

export const createEditorSlice: StateCreator<AppStore, [], [], EditorSlice> = (set, get) => ({
  editingModule: null,
  activeTool: "select",
  selectedComponentId: null,
  selectedComponentIds: [],
  selectedConnectionId: null,
  selectedRectId: null,
  _history: [],
  _future: [],

  openModuleForEditing: (module) => {
    const mod = JSON.parse(JSON.stringify(module));
    if (!mod.connections) mod.connections = [];
    set({
      editingModule: mod,
      selectedComponentId: null,
      selectedComponentIds: [],
      selectedConnectionId: null,
      activeTool: "select",
      _history: [],
      _future: [],
    });
  },

  createNewModule: (name, widthHP) =>
    set({
      editingModule: {
        id: crypto.randomUUID(),
        name,
        widthHP,
        components: [],
        connections: [],
      },
      selectedComponentId: null,
      selectedComponentIds: [],
      selectedConnectionId: null,
      activeTool: "select",
      _history: [],
      _future: [],
    }),

  closeEditor: () =>
    set({ editingModule: null, selectedComponentId: null, selectedComponentIds: [], selectedConnectionId: null, selectedRectId: null, activeTool: "select", _history: [], _future: [] }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  selectComponent: (id) => set({ selectedComponentId: id, selectedComponentIds: id ? [id] : [], selectedConnectionId: null, selectedRectId: null }),

  selectComponents: (ids) => set({ selectedComponentIds: ids, selectedComponentId: ids.length === 1 ? ids[0] : null, selectedConnectionId: null, selectedRectId: null }),

  selectConnection: (id) => set({ selectedConnectionId: id, selectedComponentId: null, selectedComponentIds: [], selectedRectId: null }),

  selectRect: (id) => set({ selectedRectId: id, selectedConnectionId: null, selectedComponentId: null, selectedComponentIds: [] }),

  addRect: (from, to) =>
    set((state) => {
      if (!state.editingModule) return state;
      const rect: PanelRect = { id: crypto.randomUUID(), from, to };
      return {
        ...pushHistory(state),
        editingModule: { ...state.editingModule, rects: [...(state.editingModule.rects ?? []), rect] },
        selectedRectId: rect.id,
        selectedConnectionId: null,
        selectedComponentId: null,
        selectedComponentIds: [],
      };
    }),

  updateRect: (id, updates) =>
    set((state) => {
      if (!state.editingModule) return state;
      return {
        ...pushHistory(state),
        editingModule: {
          ...state.editingModule,
          rects: (state.editingModule.rects ?? []).map((r) => r.id === id ? { ...r, ...updates } : r),
        },
      };
    }),

  removeRect: (id) =>
    set((state) => {
      if (!state.editingModule) return state;
      return {
        ...pushHistory(state),
        editingModule: {
          ...state.editingModule,
          rects: (state.editingModule.rects ?? []).filter((r) => r.id !== id),
        },
        selectedRectId: state.selectedRectId === id ? null : state.selectedRectId,
      };
    }),

  updateModuleName: (name) =>
    set((state) => {
      if (!state.editingModule) return state;
      return { ...pushHistory(state), editingModule: { ...state.editingModule, name } };
    }),

  updateModuleWidth: (widthHP) =>
    set((state) => {
      if (!state.editingModule) return state;
      return { ...pushHistory(state), editingModule: { ...state.editingModule, widthHP: Math.max(1, widthHP) } };
    }),

  updateModuleTags: (tags) =>
    set((state) => {
      if (!state.editingModule) return state;
      return { ...pushHistory(state), editingModule: { ...state.editingModule, tags } };
    }),

  addComponent: (kind, position) =>
    set((state) => {
      if (!state.editingModule) return state;
      const occupied = state.editingModule.components.some(
        (c) => c.position.gridX === position.gridX && c.position.gridY === position.gridY
      );
      if (occupied) return state;
      const newComponent: PanelComponent = {
        id: crypto.randomUUID(),
        kind,
        position,
        label: "",
        rotation: 0,
      };
      return {
        ...pushHistory(state),
        editingModule: {
          ...state.editingModule,
          components: [...state.editingModule.components, newComponent],
        },
        selectedComponentId: newComponent.id,
        selectedComponentIds: [newComponent.id],
      };
    }),

  updateComponent: (id, updates) =>
    set((state) => {
      if (!state.editingModule) return state;
      return {
        ...pushHistory(state),
        editingModule: {
          ...state.editingModule,
          components: state.editingModule.components.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        },
      };
    }),

  updateComponents: (ids, updates) =>
    set((state) => {
      if (!state.editingModule) return state;
      const idSet = new Set(ids);
      return {
        ...pushHistory(state),
        editingModule: {
          ...state.editingModule,
          components: state.editingModule.components.map((c) =>
            idSet.has(c.id) ? { ...c, ...updates } : c
          ),
        },
      };
    }),

  removeComponent: (id) =>
    set((state) => {
      if (!state.editingModule) return state;
      return {
        ...pushHistory(state),
        editingModule: {
          ...state.editingModule,
          components: state.editingModule.components.filter((c) => c.id !== id),
        },
        selectedComponentId: state.selectedComponentId === id ? null : state.selectedComponentId,
        selectedComponentIds: state.selectedComponentIds.filter((sid) => sid !== id),
      };
    }),

  removeComponents: (ids) =>
    set((state) => {
      if (!state.editingModule) return state;
      const idSet = new Set(ids);
      return {
        ...pushHistory(state),
        editingModule: {
          ...state.editingModule,
          components: state.editingModule.components.filter((c) => !idSet.has(c.id)),
        },
        selectedComponentId: null,
        selectedComponentIds: [],
      };
    }),

  moveComponent: (id, position) =>
    set((state) => {
      if (!state.editingModule) return state;
      const occupied = state.editingModule.components.some(
        (c) => c.id !== id && c.position.gridX === position.gridX && c.position.gridY === position.gridY
      );
      if (occupied) return state;
      return {
        editingModule: {
          ...state.editingModule,
          components: state.editingModule.components.map((c) =>
            c.id === id ? { ...c, position } : c
          ),
        },
      };
    }),

  moveComponentsByDelta: (ids, deltaX, deltaY) =>
    set((state) => {
      if (!state.editingModule) return state;
      const idSet = new Set(ids);
      const newPositions = new Map<string, GridPosition>();
      for (const comp of state.editingModule.components) {
        if (idSet.has(comp.id)) {
          newPositions.set(comp.id, {
            gridX: comp.position.gridX + deltaX,
            gridY: comp.position.gridY + deltaY,
          });
        }
      }
      // Check for collisions with non-moving components
      for (const comp of state.editingModule.components) {
        if (!idSet.has(comp.id)) {
          for (const [, pos] of newPositions) {
            if (pos.gridX === comp.position.gridX && pos.gridY === comp.position.gridY) {
              return state; // collision, abort
            }
          }
        }
      }
      return {
        editingModule: {
          ...state.editingModule,
          components: state.editingModule.components.map((c) =>
            newPositions.has(c.id) ? { ...c, position: newPositions.get(c.id)! } : c
          ),
        },
      };
    }),

  duplicateComponent: (id) => {
    const state = get();
    if (!state.editingModule) return null;
    const comp = state.editingModule.components.find((c) => c.id === id);
    if (!comp) return null;
    const newId = crypto.randomUUID();
    const clone: PanelComponent = { ...comp, id: newId };
    set({
      ...pushHistory(state),
      editingModule: {
        ...state.editingModule,
        components: [...state.editingModule.components, clone],
      },
      selectedComponentId: newId,
      selectedComponentIds: [newId],
    });
    return newId;
  },

  updateModuleCode: (code) =>
    set((state) => {
      if (!state.editingModule) return state;
      return { ...pushHistory(state), editingModule: { ...state.editingModule, code } };
    }),

  addConnection: (kind, from, to, startOffset, endOffset) =>
    set((state) => {
      if (!state.editingModule) return state;
      const conn: Connection = {
        id: crypto.randomUUID(),
        kind,
        from,
        to,
        startOffset,
        endOffset,
      };
      return {
        ...pushHistory(state),
        editingModule: {
          ...state.editingModule,
          connections: [...(state.editingModule.connections ?? []), conn],
        },
        selectedConnectionId: conn.id,
        selectedComponentId: null,
        selectedComponentIds: [],
      };
    }),

  updateConnection: (id, updates) =>
    set((state) => {
      if (!state.editingModule) return state;
      return {
        ...pushHistory(state),
        editingModule: {
          ...state.editingModule,
          connections: (state.editingModule.connections ?? []).map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        },
      };
    }),

  removeConnection: (id) =>
    set((state) => {
      if (!state.editingModule) return state;
      return {
        ...pushHistory(state),
        editingModule: {
          ...state.editingModule,
          connections: (state.editingModule.connections ?? []).filter((c) => c.id !== id),
        },
        selectedConnectionId: state.selectedConnectionId === id ? null : state.selectedConnectionId,
      };
    }),

  pushSnapshot: () =>
    set((state) => pushHistory(state)),

  undo: () =>
    set((state) => {
      if (state._history.length === 0 || !state.editingModule) return state;
      const history = [...state._history];
      const previous = history.pop()!;
      const future = [JSON.parse(JSON.stringify(state.editingModule)), ...state._future];
      return {
        editingModule: previous,
        _history: history,
        _future: future,
        selectedComponentId: null,
        selectedComponentIds: [],
        selectedConnectionId: null,
        selectedRectId: null,
      };
    }),

  redo: () =>
    set((state) => {
      if (state._future.length === 0 || !state.editingModule) return state;
      const future = [...state._future];
      const next = future.shift()!;
      const history = [...state._history, JSON.parse(JSON.stringify(state.editingModule))];
      return {
        editingModule: next,
        _history: history,
        _future: future,
        selectedComponentId: null,
        selectedComponentIds: [],
        selectedConnectionId: null,
        selectedRectId: null,
      };
    }),
});
