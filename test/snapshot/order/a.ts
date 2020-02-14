export interface C {
  c: number;
}

export interface B {
  b: string;
}

export interface A {
  a: A;
  c: C;
  b: B;
}
