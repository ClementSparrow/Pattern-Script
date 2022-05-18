/**
 * Seedable random number generator functions.
 * @version 1.0.0
 * @license Public Domain
 *
 * @example
 * var rng = new RNG('Example');
 * rng.random(40, 50);  // =>  42
 * rng.uniform();       // =>  0.7972798995050903
 */

/**
 * Get the underlying bytes of this string.
 * @return {Array} An array of bytes
 */
String.prototype.getBytes = function() {
    var output = [];
    for (var i = 0; i < this.length; i++) {
        var c = this.charCodeAt(i);
        var bytes = [];
        do {
            bytes.push(c & 0xFF);
            c = c >> 8;
        } while (c > 0);
        output = output.concat(bytes.reverse());
    }
    return output;
}

/**
 * @param {String} seed A string to seed the generator.
 * @constructor
 */
function RC4(seed) {
    this.s = new Array(256);
    this.i = 0;
    this.j = 0;
    for (var i = 0; i < 256; i++) {
        this.s[i] = i;
    }
    if (seed) {
        this.mix(seed);
    }
}

RC4.prototype._swap = function(i, j) {
    var tmp = this.s[i];
    this.s[i] = this.s[j];
    this.s[j] = tmp;
}

/**
 * Mix additional entropy into this generator.
 * @param {String} seed
 */
RC4.prototype.mix = function(seed)
{
	const input = seed.getBytes()
    var j = 0;
    for (var i = 0; i < this.s.length; i++) {
        j += this.s[i] + input[i % input.length];
        j %= 256;
        this._swap(i, j);
    }
}

/**
 * @return {number} The next byte of output from the generator.
 */
RC4.prototype.next = function() {
    this.i = (this.i + 1) % 256;
    this.j = (this.j + this.s[this.i]) % 256;
    this._swap(this.i, this.j);
    return this.s[(this.s[this.i] + this.s[this.j]) % 256];
}

/**
 * Create a new random number generator with optional seed. If the
 * provided seed is a function (i.e. Math.random) it will be used as
 * the uniform number generator.
 * @param seed An arbitrary object used to seed the generator.
 * @constructor
 */
function RNG(seed)
{
	if (seed == null) {
		seed = (Math.random() + Date.now()).toString()
	}
	else if (Object.prototype.toString.call(seed) !== '[object String]') {
	    seed = JSON.stringify(seed);
	}
	this.seed = seed
	this._state = seed ? new RC4(seed) : null
}

/**
 * @return {number} Uniform random number between 0 and 255.
 */
RNG.prototype.nextByte = function() {
    return this._state.next();
}

/**
 * @return {number} Uniform random number between 0 and 1.
 */
RNG.prototype.uniform = function() {
    const BYTES = 7; // 56 bits to make a 53-bit double
    var output = 0;
    for (var i = 0; i < BYTES; i++) {
        output *= 256;
        output += this.nextByte();
    }
    return output / (Math.pow(2, BYTES * 8) - 1);
}

// Returns an integer in [0,max[
RNG.prototype.integer = function(max) { return Math.floor(max*this.uniform()) }

// Returns a random element of an array
RNG.prototype.pickInArray = function(arr) { return arr[this.integer(arr.length)] }
