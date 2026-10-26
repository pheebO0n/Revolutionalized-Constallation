function makeRng(seed) {
 let state = (seed >>> 0) || 1;
 function random() {
 state ^= state << 13; state >>>= 0;
 state ^= state >>> 17;
 state ^= state << 5; state >>>= 0;
 return state / 4294967296;
 }
 random.int = (n) => Math.floor(random() * n);
 return random;
}
module.exports = { makeRng };
