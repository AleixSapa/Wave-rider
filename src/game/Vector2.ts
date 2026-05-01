export class Vector2 {
  constructor(public x: number = 0, public y: number = 0) {}
  
  add(v: Vector2) { return new Vector2(this.x + v.x, this.y + v.y); }
  sub(v: Vector2) { return new Vector2(this.x - v.x, this.y - v.y); }
  mult(n: number) { return new Vector2(this.x * n, this.y * n); }
  mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  normalize() {
    const m = this.mag();
    return m === 0 ? new Vector2() : new Vector2(this.x / m, this.y / m);
  }
}
