/*
 * A slider from -1 (opposite) to +1 (match) in steps of 0.01: a white bar, the value and a word for it above.
 * makeSlider(initial, onChange) returns the element; onChange gets the new value.
 * Needs scoring.js (HV.signed).
 */
function sliderWord(value) {
  if (value <= -0.75) return 'Opposite';
  if (value <= -0.375) return 'Moderately opposite';
  if (value <= -0.125) return 'Slightly opposite';
  if (value < 0.125) return 'Neutral';
  if (value < 0.375) return 'Slightly match';
  if (value < 0.625) return 'Moderately match';
  if (value < 0.875) return 'Strongly match';
  return 'Match';
}

function makeSlider(initial, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'slider-block';

  const readout = document.createElement('div');
  readout.className = 'slider-readout';
  const number = document.createElement('div');
  number.className = 'slider-number';
  const word = document.createElement('div');
  word.className = 'slider-word';
  readout.appendChild(number);
  readout.appendChild(word);
  const show = value => {
    number.textContent = HV.signed(value);
    word.textContent = sliderWord(value);
  };
  show(initial);

  const slider = document.createElement('div');
  slider.className = 'slider';
  const bar = document.createElement('div');
  bar.className = 'slider-bar';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = -100;
  input.max = 100;
  input.step = 1;
  input.value = Math.round(initial * 100);
  input.setAttribute('aria-label', 'How much this value matches you, from -1 (opposite) to +1 (match)');
  input.oninput = () => {
    const value = Number(input.value) / 100;
    show(value);
    onChange(value);
  };
  slider.appendChild(bar);
  slider.appendChild(input);

  const labels = document.createElement('div');
  labels.className = 'slider-labels';
  ['Opposite', 'Neutral', 'Match'].forEach(text => {
    const label = document.createElement('span');
    label.textContent = text;
    labels.appendChild(label);
  });

  wrap.appendChild(readout);
  wrap.appendChild(slider);
  wrap.appendChild(labels);
  return wrap;
}
