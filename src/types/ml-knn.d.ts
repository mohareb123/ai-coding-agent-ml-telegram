declare module "ml-knn" {
  export type KNNOptions = {
    k?: number;
    distance?: (a: number[], b: number[]) => number;
  };

  export default class KNN {
    constructor(dataset: number[][], labels: number[] | string[], options?: KNNOptions);
    predict(dataset: number[][]): Array<number | string>;
    toJSON(): Record<string, unknown>;
    static load(model: object, distance?: (a: number[], b: number[]) => number): KNN;
  }
}
