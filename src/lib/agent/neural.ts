export type TrainItem = {
  x: number[];
  y: number[];
};

export type SerializedNetwork = {
  w1: number[][];
  b1: number[];
  w2: number[][];
  b2: number[];
};

function randomWeight() {
  return (Math.random() - 0.5) * 0.1;
}

function matVecMul(matrix: number[][], vector: number[]): number[] {
  return matrix.map((row) => row.reduce((acc, w, idx) => acc + w * (vector[idx] ?? 0), 0));
}

function add(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + (b[i] ?? 0));
}

function relu(v: number[]): number[] {
  return v.map((x) => (x > 0 ? x : 0));
}

function reluDeriv(v: number[]): number[] {
  return v.map((x) => (x > 0 ? 1 : 0));
}

function softmax(logits: number[]): number[] {
  const maxLogit = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - maxLogit));
  const sumExp = exps.reduce((acc, v) => acc + v, 0);
  return exps.map((v) => v / (sumExp || 1));
}

function outer(a: number[], b: number[]): number[][] {
  return a.map((av) => b.map((bv) => av * bv));
}

function transpose(matrix: number[][]): number[][] {
  if (!matrix.length) return [];
  const rows = matrix.length;
  const cols = matrix[0].length;
  const t = Array.from({ length: cols }, () => new Array(rows).fill(0));

  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      t[j][i] = matrix[i][j];
    }
  }

  return t;
}

export class TinyNeuralNetwork {
  inputSize: number;
  hiddenSize: number;
  outputSize: number;
  w1: number[][];
  b1: number[];
  w2: number[][];
  b2: number[];

  constructor(inputSize: number, hiddenSize: number, outputSize: number, seed?: SerializedNetwork) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;

    this.w1 =
      seed?.w1 ??
      Array.from({ length: hiddenSize }, () => Array.from({ length: inputSize }, () => randomWeight()));
    this.b1 = seed?.b1 ?? Array.from({ length: hiddenSize }, () => 0);
    this.w2 =
      seed?.w2 ??
      Array.from({ length: outputSize }, () => Array.from({ length: hiddenSize }, () => randomWeight()));
    this.b2 = seed?.b2 ?? Array.from({ length: outputSize }, () => 0);
  }

  forward(x: number[]) {
    const z1 = add(matVecMul(this.w1, x), this.b1);
    const a1 = relu(z1);
    const z2 = add(matVecMul(this.w2, a1), this.b2);
    const probs = softmax(z2);
    return { z1, a1, z2, probs };
  }

  train(dataset: TrainItem[], epochs = 140, learningRate = 0.05) {
    let avgLoss = 0;

    for (let epoch = 0; epoch < epochs; epoch += 1) {
      let epochLoss = 0;

      for (const item of dataset) {
        const { x, y } = item;
        const { z1, a1, probs } = this.forward(x);

        const epsilon = 1e-8;
        const loss = -y.reduce((acc, yi, i) => acc + yi * Math.log((probs[i] ?? epsilon) + epsilon), 0);
        epochLoss += loss;

        const dz2 = probs.map((p, i) => p - (y[i] ?? 0));
        const dw2 = outer(dz2, a1);
        const db2 = dz2;

        const w2T = transpose(this.w2);
        const da1 = matVecMul(w2T, dz2);
        const dz1 = da1.map((v, i) => v * reluDeriv(z1)[i]);
        const dw1 = outer(dz1, x);
        const db1 = dz1;

        for (let i = 0; i < this.outputSize; i += 1) {
          for (let j = 0; j < this.hiddenSize; j += 1) {
            this.w2[i][j] -= learningRate * dw2[i][j];
          }
          this.b2[i] -= learningRate * db2[i];
        }

        for (let i = 0; i < this.hiddenSize; i += 1) {
          for (let j = 0; j < this.inputSize; j += 1) {
            this.w1[i][j] -= learningRate * dw1[i][j];
          }
          this.b1[i] -= learningRate * db1[i];
        }
      }

      avgLoss = epochLoss / Math.max(1, dataset.length);
    }

    return avgLoss;
  }

  predict(x: number[]): number[] {
    return this.forward(x).probs;
  }

  serialize(): SerializedNetwork {
    return {
      w1: this.w1,
      b1: this.b1,
      w2: this.w2,
      b2: this.b2,
    };
  }
}
