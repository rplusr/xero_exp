import { Studio } from './state.js';
import { initUI } from './ui.js';

const studio = new Studio();
const { seedInput } = initUI(studio);

studio.randomise(seedInput.value || '1');
