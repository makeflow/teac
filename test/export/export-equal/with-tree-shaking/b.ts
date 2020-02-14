namespace B {
  export interface B {
    b: string;
  }

  export interface BB {
    bb: string;
  }
}

type BBC = B.B;

export = BBC;
