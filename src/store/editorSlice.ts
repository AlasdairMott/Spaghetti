import type { StateCreator } from "zustand";
import type { Module, PanelComponent, ComponentKind, GridPosition, Tool } from "../models/types";
import type { AppStore } from "./index";

const MAX_HISTORY = 100;

export interface EditorSlice {
  editingModule: Module | null;
  activeTool: Tool;
  selectedComponentId: string | null;
  selectedComponentIds: string[];
  _history: Module[];
  _future: Module[];

  openModuleForEditing: (module: Module) => void;
  createNewModule: (name: string, widthHP: number) => void;
  closeEditor: () => void;

  setActiveTool: (tool: Tool) => void;
  selectComponent: (id: string | null) => void;
  selectComponents: (ids: string[]) => void;

  updateModuleName: (name: string) => void;
  updateModuleWidth: (widthHP: number) => void;

  addComponent: (kind: ComponentKind, position: GridPosition) => void;
  updateComponent: (id: string, updates: Partial<PanelComponent>) => void;
  removeComponent: (id: string) => void;
  moveComponent: (id: string, position: GridPosition) => void;
  moveComponentsByDelta: (ids: string[], deltaX: number, deltaY: number) => void;
  duplicateComponent: (id: string) => string | null;
  pushSnapshot: () => void;

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
  _history: [],
  _future: [],

  openModuleForEditing: (module) =>
    set({
      editingModule: JSON.parse(JSON.stringify(module)),
      selectedComponentId: null,
      selectedComponentIds: [],
      activeTool: "select",
      _history: [],
      _future: [],
    }),

  createNewModule: (name, widthHP) =>
    set({
      editingModule: {
        id: crypto.randomUUID(),
        name,
        widthHP,
        components: [],
      },
      selectedComponentId: null,
      selectedComponentIds: [],
      activeTool: "select",
      _history: [],
      _future: [],
    }),

  closeEditor: () =>
    set({ editingModule: null, selectedComponentId: null, selectedComponentIds: [], activeTool: "select", _history: [], _future: [] }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  selectComponent: (id) => set({ selectedComponentId: id, selectedComponentIds: id ? [id] : [] }),

  selectComponents: (ids) => set({ selectedComponentIds: ids, selectedComponentId: ids.length === 1 ? ids[0] : null }),

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
      };
    }),
});
