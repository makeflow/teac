interface AA {
  aa: string;
}

interface BB {
  aa: number;
}

export type A = {
  [P in keyof AA]?: BB[P];
}
