export const store = {
  data: [],
  filtered: [],
  modalData: [],
  filters: {},

  set(key, value) {
    this[key] = value;
  }
};