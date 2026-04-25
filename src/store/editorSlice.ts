import type { StateCreator } from "zustand";
import type { Module, PanelComponent, ComponentKind, GridPosition, Tool, ConnectionKind, MmPoint, Connection, PanelRect } from "../models/types";
import type { AppStore } from "./index";
import { GRID_X, GRID_Y } from "../constants/grid";

const MAX_HISTORY = 100;

export interface EditorSlice {
  editingModule: Module | null;
  activeTool: Tool;
  selectedComponentId: string | null;
  selectedComponentIds: string[];
  selectedConnectionId: string | null;
  selectedConnectionIds: string[];
  selectedRectId: string | null;
  selectedRectIds: string[];
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
  selectItems: (componentIds: string[], connectionIds: string[], rectIds: string[]) => void;

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
  moveConnectionsByDelta: (ids: string[], dxMm: number, dyMm: number) => void;
  moveRectsByDelta: (ids: string[], dxMm: number, dyMm: number) => void;
  duplicateItems: (componentIds: string[], connectionIds: string[], rectIds: string[]) => { componentIds: string[]; connectionIds: string[]; rectIds: string[] } | null;
  clipboard: { components: PanelComponent[]; connections: Connection[]; rects: PanelRect[] } | null;
  copySelection: () => void;
  cutSelection: () => void;
  pasteSelection: () => void;
  pushSnapshot: () => void;

  updateModuleCode: (code: string) => void;

  addConnection: (kind: ConnectionKind, from: MmPoint, to: MmPoint, startOffset?: number, endOffset?: number) => void;
  updateConnection: (id: string, updates: Partial<Connection>) => void;
  removeConnection: (id: string) => void;

  undo: () => void;
  redo: () => void;
}

/** Resolve the current selection to concrete item arrays. */
function resolveSelection(state: AppStore) {
  const mod = state.editingModule!;
  return {
    components: state.selectedComponentIds.map((id) => mod.components.find((c) => c.id === id)).filter(Boolean) as PanelComponent[],
    connections: state.selectedConnectionIds.map((id) => (mod.connections ?? []).find((c) => c.id === id)).filter(Boolean) as Connection[],
    rects: state.selectedRectIds.map((id) => (mod.rects ?? []).find((r) => r.id === id)).filter(Boolean) as PanelRect[],
  };
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
  selectedConnectionIds: [],
  selectedRectId: null,
  selectedRectIds: [],
  _history: [],
  _future: [],
  clipboard: null,

  openModuleForEditing: (module) => {
    const mod = JSON.parse(JSON.stringify(module));
    if (!mod.connections) mod.connections = [];
    set({
      editingModule: mod,
      selectedComponentId: null,
      selectedComponentIds: [],
      selectedConnectionId: null,
      selectedConnectionIds: [],
      selectedRectId: null,
      selectedRectIds: [],
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
      selectedConnectionIds: [],
      selectedRectId: null,
      selectedRectIds: [],
      activeTool: "select",
      _history: [],
      _future: [],
    }),

  closeEditor: () =>
    set({ editingModule: null, selectedComponentId: null, selectedComponentIds: [], selectedConnectionId: null, selectedConnectionIds: [], selectedRectId: null, selectedRectIds: [], activeTool: "select", _history: [], _future: [] }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  selectComponent: (id) => set({ selectedComponentId: id, selectedComponentIds: id ? [id] : [], selectedConnectionId: null, selectedConnectionIds: [], selectedRectId: null, selectedRectIds: [] }),

  selectComponents: (ids) => set({ selectedComponentIds: ids, selectedComponentId: ids.length === 1 ? ids[0] : null, selectedConnectionId: null, selectedConnectionIds: [], selectedRectId: null, selectedRectIds: [] }),

  selectConnection: (id) => set({ selectedConnectionId: id, selectedConnectionIds: id ? [id] : [], selectedComponentId: null, selectedComponentIds: [], selectedRectId: null, selectedRectIds: [] }),

  selectRect: (id) => set({ selectedRectId: id, selectedRectIds: id ? [id] : [], selectedConnectionId: null, selectedConnectionIds: [], selectedComponentId: null, selectedComponentIds: [] }),

  selectItems: (componentIds, connectionIds, rectIds) => set({
    selectedComponentIds: componentIds,
    selectedComponentId: componentIds.length === 1 ? componentIds[0] : null,
    selectedConnectionIds: connectionIds,
    selectedConnectionId: connectionIds.length === 1 ? connectionIds[0] : null,
    selectedRectIds: rectIds,
    selectedRectId: rectIds.length === 1 ? rectIds[0] : null,
  }),

  addRect: (from, to) =>
    set((state) => {
      if (!state.editingModule) return state;
      const rect: PanelRect = { id: crypto.randomUUID(), from, to };
      return {
        ...pushHistory(state),
        editingModule: { ...state.editingModule, rects: [...(state.editingModule.rects ?? []), rect] },
        selectedRectId: rect.id,
        selectedRectIds: [rect.id],
        selectedConnectionId: null,
        selectedConnectionIds: [],
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

  moveConnectionsByDelta: (ids, dxMm, dyMm) =>
    set((state) => {
      if (!state.editingModule || ids.length === 0) return state;
      const idSet = new Set(ids);
      return {
        editingModule: {
          ...state.editingModule,
          connections: (state.editingModule.connections ?? []).map((c) =>
            idSet.has(c.id) ? {
              ...c,
              from: { x: c.from.x + dxMm, y: c.from.y + dyMm },
              to: { x: c.to.x + dxMm, y: c.to.y + dyMm },
            } : c
          ),
        },
      };
    }),

  moveRectsByDelta: (ids, dxMm, dyMm) =>
    set((state) => {
      if (!state.editingModule || ids.length === 0) return state;
      const idSet = new Set(ids);
      return {
        editingModule: {
          ...state.editingModule,
          rects: (state.editingModule.rects ?? []).map((r) =>
            idSet.has(r.id) ? {
              ...r,
              from: { x: r.from.x + dxMm, y: r.from.y + dyMm },
              to: { x: r.to.x + dxMm, y: r.to.y + dyMm },
            } : r
          ),
        },
      };
    }),

  duplicateItems: (componentIds, connectionIds, rectIds) => {
    const state = get();
    if (!state.editingModule) return null;
    const reId = <T extends { id: string }>(item: T): T => ({ ...item, id: crypto.randomUUID() });
    const mod = state.editingModule;
    const newComponents = componentIds.map((id) => mod.components.find((c) => c.id === id)).filter(Boolean).map((c) => reId(c!));
    const newConnections = connectionIds.map((id) => (mod.connections ?? []).find((c) => c.id === id)).filter(Boolean).map((c) => reId(c!));
    const newRects = rectIds.map((id) => (mod.rects ?? []).find((r) => r.id === id)).filter(Boolean).map((r) => reId(r!));
    const sel = {
      componentIds: newComponents.map((c) => c.id),
      connectionIds: newConnections.map((c) => c.id),
      rectIds: newRects.map((r) => r.id),
    };
    set({
      ...pushHistory(state),
      editingModule: {
        ...mod,
        components: [...mod.components, ...newComponents],
        connections: [...(mod.connections ?? []), ...newConnections],
        rects: [...(mod.rects ?? []), ...newRects],
      },
      selectedComponentIds: sel.componentIds,
      selectedComponentId: sel.componentIds.length === 1 ? sel.componentIds[0] : null,
      selectedConnectionIds: sel.connectionIds,
      selectedConnectionId: sel.connectionIds.length === 1 ? sel.connectionIds[0] : null,
      selectedRectIds: sel.rectIds,
      selectedRectId: sel.rectIds.length === 1 ? sel.rectIds[0] : null,
    });
    return sel;
  },

  copySelection: () => {
    const state = get();
    if (!state.editingModule) return;
    const sel = resolveSelection(state);
    if (!sel.components.length && !sel.connections.length && !sel.rects.length) return;
    set({ clipboard: sel });
  },

  cutSelection: () => {
    const state = get();
    if (!state.editingModule) return;
    const sel = resolveSelection(state);
    if (!sel.components.length && !sel.connections.length && !sel.rects.length) return;
    const compSet = new Set(state.selectedComponentIds);
    const connSet = new Set(state.selectedConnectionIds);
    const rectSet = new Set(state.selectedRectIds);
    set({
      ...pushHistory(state),
      clipboard: sel,
      editingModule: {
        ...state.editingModule,
        components: state.editingModule.components.filter((c) => !compSet.has(c.id)),
        connections: (state.editingModule.connections ?? []).filter((c) => !connSet.has(c.id)),
        rects: (state.editingModule.rects ?? []).filter((r) => !rectSet.has(r.id)),
      },
      selectedComponentId: null, selectedComponentIds: [],
      selectedConnectionId: null, selectedConnectionIds: [],
      selectedRectId: null, selectedRectIds: [],
    });
  },

  pasteSelection: () => {
    const state = get();
    if (!state.editingModule || !state.clipboard) return;
    const { components, connections, rects } = state.clipboard;
    const reId = <T extends { id: string }>(item: T): T => ({ ...item, id: crypto.randomUUID() });
    const newComponents = components.map((c) => ({ ...reId(c), position: { gridX: c.position.gridX + 1, gridY: c.position.gridY + 1 } }));
    const newConnections = connections.map((c) => ({ ...reId(c), from: { x: c.from.x + GRID_X, y: c.from.y + GRID_Y }, to: { x: c.to.x + GRID_X, y: c.to.y + GRID_Y } }));
    const newRects = rects.map((r) => ({ ...reId(r), from: { x: r.from.x + GRID_X, y: r.from.y + GRID_Y }, to: { x: r.to.x + GRID_X, y: r.to.y + GRID_Y } }));
    const compIds = newComponents.map((c) => c.id);
    const connIds = newConnections.map((c) => c.id);
    const rectIds = newRects.map((r) => r.id);
    set({
      ...pushHistory(state),
      editingModule: {
        ...state.editingModule,
        components: [...state.editingModule.components, ...newComponents],
        connections: [...(state.editingModule.connections ?? []), ...newConnections],
        rects: [...(state.editingModule.rects ?? []), ...newRects],
      },
      selectedComponentIds: compIds,
      selectedComponentId: compIds.length === 1 ? compIds[0] : null,
      selectedConnectionIds: connIds,
      selectedConnectionId: connIds.length === 1 ? connIds[0] : null,
      selectedRectIds: rectIds,
      selectedRectId: rectIds.length === 1 ? rectIds[0] : null,
    });
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
        selectedConnectionIds: [conn.id],
        selectedComponentId: null,
        selectedComponentIds: [],
        selectedRectId: null,
        selectedRectIds: [],
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
        selectedConnectionIds: [],
        selectedRectId: null,
        selectedRectIds: [],
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
        selectedConnectionIds: [],
        selectedRectId: null,
        selectedRectIds: [],
      };
    }),
});
