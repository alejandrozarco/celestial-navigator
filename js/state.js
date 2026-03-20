export function createStore(initial) {
  let state = { ...initial };
  const listeners = {};

  return {
    get() { return Object.freeze({ ...state }); },

    update(patch) {
      state = { ...state, ...patch };
      const event = 'change';
      (listeners[event] || []).forEach(fn => fn(state));
    },

    on(event, fn) {
      (listeners[event] = listeners[event] || []).push(fn);
    },

    off(event, fn) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(f => f !== fn);
      }
    }
  };
}

export const INITIAL_STATE = {
  mode: 'sights',
  ap: { lat: 34, lon: -118 },
  utc: new Date(),
  magDecl: 0,
  observations: [],
  image: null,
  detections: [],
  identifiedStars: [],
  plateSolution: null,
  horizon: null,
  lops: [],
  fix: null
};
