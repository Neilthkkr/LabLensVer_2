// Synthetic report rows only. Each case is rendered to an image in temporary
// Chrome and passed through the same upload/OCR/parser/save path as a user file.
export const liveOcrCases = [
  {
    id: 'clean-two-results',
    rows: ['Glucose 106 mg/dL 70 - 99', 'Hemoglobin 13.8 g/dL 12 - 16'],
    expected: [
      { key: 'glucose', value: 106, unit: 'mg/dL', min: 70, max: 99, status: 'high' },
      { key: 'hemoglobin', value: 13.8, unit: 'g/dL', min: 12, max: 16, status: 'normal' }
    ]
  },
  {
    id: 'decimal-comma-and-units',
    rows: ['Glucose 5,6 mmol/L 3,9 - 5,5', 'Hemoglobin 132 g/L 120 - 160'],
    expected: [
      { key: 'glucose', value: 5.6, unit: 'mmol/L', min: 3.9, max: 5.5, status: 'high' },
      { key: 'hemoglobin', value: 132, unit: 'g/L', min: 120, max: 160, status: 'normal' }
    ]
  },
  {
    id: 'current-and-previous',
    rows: ['Test Current Previous Unit Reference', 'Glucose 105 95 mg/dL 70 - 99', 'Hemoglobin 13.8 13.5 g/dL 12 - 16'],
    expected: [
      { key: 'glucose', value: 105, unit: 'mg/dL', min: 70, max: 99, status: 'high' },
      { key: 'hemoglobin', value: 13.8, unit: 'g/dL', min: 12, max: 16, status: 'normal' }
    ]
  },
  {
    id: 'limit-results',
    rows: ['eGFR > 90 mL/min/1.73m2 > 60', 'TSH < 0.0083 uIU/mL 0.35 - 4.94'],
    expected: [
      { key: 'egfr', value: 90, unit: 'mL/min/1.73m2', min: 60, max: null, status: 'normal', qualifier: '>' },
      { key: 'tsh', value: 0.0083, unit: 'uIU/mL', min: 0.35, max: 4.94, status: 'low', qualifier: '<' }
    ]
  },
  {
    id: 'shadow-and-skew',
    render: 'shadow-skew',
    rows: ['Glucose 108 mg/dL 70 - 99', 'Vitamin D 24 ng/mL 30 - 100'],
    expected: [
      { key: 'glucose', value: 108, unit: 'mg/dL', min: 70, max: 99, status: 'high' },
      { key: 'vitamin d', value: 24, unit: 'ng/mL', min: 30, max: 100, status: 'low' }
    ]
  }
];
