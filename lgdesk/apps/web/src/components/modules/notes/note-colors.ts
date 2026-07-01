// Fixed pastel palette for Keep-style Note cards (Part 28: "Color (hex or name)").
// Stored on the Note as a plain hex string (or '' for the card's default surface).
export interface NoteColorSwatch {
  value: string;
  label: string;
}

export const NOTE_COLORS: NoteColorSwatch[] = [
  { value: '', label: 'Default' },
  { value: '#fde8e8', label: 'Red' },
  { value: '#fff3e0', label: 'Orange' },
  { value: '#fff9c4', label: 'Yellow' },
  { value: '#e8f5e9', label: 'Green' },
  { value: '#e0f2f1', label: 'Teal' },
  { value: '#e3f2fd', label: 'Blue' },
  { value: '#ede7f6', label: 'Purple' },
];
