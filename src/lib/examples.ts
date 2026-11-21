/** Example catalogue: the course test cases, the book's Table 4.2 letters we know, and gallery shapes. */
export interface Example {
  id: string;
  group: 'Course examples' | 'Book Table 4.2' | 'Gallery (classic shapes)' | 'Special cases';
  label: string;
  num: string;
  den: string;
}

export const EXAMPLES: Example[] = [
  { id: 'class', group: 'Course examples', label: 'Class example: K / s(s+4)(s+5)', num: '1', den: 's(s+4)(s+5)' },
  { id: 'p1', group: 'Course examples', label: 'Problem 1: K / s(s+3)(s²+2s+2)', num: '1', den: 's(s+3)(s^2+2s+2)' },
  { id: 'entry', group: 'Course examples', label: 'Entry point: K(s+2) / (s²+2s+3)', num: 's+2', den: 's^2+2s+3' },
  { id: 'cz', group: 'Course examples', label: 'Complex zeros: K(s²+2s+2) / s(s+3)(s+5)', num: 's^2+2s+2', den: 's(s+3)(s+5)' },

  { id: 'book-a', group: 'Book Table 4.2', label: '(a) K(s+3) / (s+1)(s+5)', num: 's+3', den: '(s+1)(s+5)' },
  { id: 'book-c', group: 'Book Table 4.2', label: '(c) Circle: K(s+4) / (s+1)(s+2)', num: 's+4', den: '(s+1)(s+2)' },
  { id: 'book-d', group: 'Book Table 4.2', label: '(d) K / (s+1)(s+3)(s+6)', num: '1', den: '(s+1)(s+3)(s+6)' },
  { id: 'book-k', group: 'Book Table 4.2', label: '(k) K(s+2) / (s+1)(s+4)(s+6)', num: 's+2', den: '(s+1)(s+4)(s+6)' },
  { id: 'book-o', group: 'Book Table 4.2', label: '(o) K / (s+4)(s+5)(s²+2s+5)', num: '1', den: '(s+4)(s+5)(s^2+2s+5)' },
  { id: 'book-p', group: 'Book Table 4.2', label: '(p) K / (s+1)(s+2)(s²+8s+20)', num: '1', den: '(s+1)(s+2)(s^2+8s+20)' },

  { id: 'g-b', group: 'Gallery (classic shapes)', label: '(b) Two real poles: K / (s+1)(s+3)', num: '1', den: '(s+1)(s+3)' },
  { id: 'g-e', group: 'Gallery (classic shapes)', label: '(e) Double integrator: K / s²', num: '1', den: 's^2' },
  { id: 'g-f', group: 'Gallery (classic shapes)', label: '(f) Circle around a zero: K(s+1) / s²', num: 's+1', den: 's^2' },
  { id: 'g-g', group: 'Gallery (classic shapes)', label: '(g) Four poles: K / s(s+1)(s+2)(s+3)', num: '1', den: 's(s+1)(s+2)(s+3)' },
  { id: 'g-h', group: 'Gallery (classic shapes)', label: '(h) Triple meeting point: K(s+1) / s²(s+9)', num: 's+1', den: 's^2(s+9)' },
  { id: 'g-i', group: 'Gallery (classic shapes)', label: '(i) Complex breakaways: K / s(s+4)(s²+4s+20)', num: '1', den: 's(s+4)(s^2+4s+20)' },
  { id: 'g-j', group: 'Gallery (classic shapes)', label: '(j) Lead-type zero: K(s+1) / s²(s+4)', num: 's+1', den: 's^2(s+4)' },
  { id: 'g-l', group: 'Gallery (classic shapes)', label: '(l) Repeated pole: K / (s+1)³', num: '1', den: '(s+1)^3' },
  { id: 'g-m', group: 'Gallery (classic shapes)', label: '(m) PID-like: K(s+1)(s+2) / s(s−1)', num: '(s+1)(s+2)', den: 's(s-1)' },
  { id: 'g-n', group: 'Gallery (classic shapes)', label: '(n) n = m: K(s²+2s+5) / (s+1)(s+3)', num: 's^2+2s+5', den: '(s+1)(s+3)' },

  { id: 'cond', group: 'Special cases', label: 'Conditionally stable: K(s²+2s+4) / s(s+4)(s+6)(s²+1.4s+1)', num: 's^2+2s+4', den: 's(s+4)(s+6)(s^2+1.4s+1)' },
  { id: 'eps', group: 'Special cases', label: 'Routh ε case: K / s(s+1)(s²+2)', num: '1', den: 's(s+1)(s^2+2)' },
  { id: 'zrow', group: 'Special cases', label: 'Routh zero row: K(s²+1) / s²(s²+4)', num: 's^2+1', den: 's^2(s^2+4)' },
  { id: 'nmp', group: 'Special cases', label: 'Non-minimum phase (0° locus): K(1−s) / s(s+2)', num: '1-s', den: 's(s+2)' },
  { id: 'q8', group: 'Special cases', label: 'High order: K / (s+1)²(s+2)(s+3)(s²+2s+5)(s²+4s+8)', num: '1', den: '(s+1)^2(s+2)(s+3)(s^2+2s+5)(s^2+4s+8)' },
];

export const DEFAULT_EXAMPLE = EXAMPLES[0];
