
function BitVec(init) {
	this.data = new Int32Array(init);
}

BitVec.prototype.clone = function() {
	return new BitVec(this.data);
}

// Operations on the whole set of bits
// ===================================

// Don't use these functions with a bitvec created from Level.getCell, which uses internally a subarray that adds layers of abstraction.
// It's faster to first getCellInto and then use the functions.

function generate_bitvec_function(formula, return_var)
{
	var params = []
	const body = formula.replace(/{([a-zA-Z_][a-zA-Z_\d]*)}/g, function(_, match)
		{
			if ( (match !== 'this') && (params.indexOf(match) < 0) )
				params.push(match)
			return match+'.data[i]'
		})
	params.sort()
	const return_value = (return_var !== undefined) ? '\nreturn ' + return_var : ''
	return Function(...params, 'for (var i=0; i<this.data.length; ++i) ' + body + return_value)
}

BitVec.prototype.cloneInto = generate_bitvec_function('{target} = {this}', 'target')

BitVec.prototype.setZero = generate_bitvec_function('{this} = 0')

BitVec.prototype.inot = generate_bitvec_function('{this} = ~{this}')

BitVec.prototype.iand = generate_bitvec_function('{this} &= {other}')

BitVec.prototype.ior = generate_bitvec_function('{this} |= {other}')

// Note that x.iclear(y) is equivalent to x.iand(y.clone().inot()) and can sometimes be optimized by precomputing y.clone().inot()
BitVec.prototype.iclear = generate_bitvec_function('{this} &= ~{other}')

BitVec.prototype.iClearAddInto = generate_bitvec_function('{dest} = ({this} & ~{a}) | {b}', 'dest')

BitVec.prototype.iAddBut = generate_bitvec_function('{this} |= {a} & ~{b}')


// Operations on individual bits
// =============================

BitVec.prototype.ibitset = function(ind) {
	this.data[ind>>5] |= 1 << (ind & 31);
}

BitVec.prototype.ibitclear = function(ind) {
	this.data[ind>>5] &= ~(1 << (ind & 31));
}

BitVec.prototype.get = function(ind) {
	return (this.data[ind>>5] & 1 << (ind & 31)) !== 0;
}

// Operations on a small subranges (for layers)
// ============================================

// TODO: it would be more efficient probably to ensure all layers fit in a single cell of the array, even if it makes using more memory (it requires at least 19 layers to use
// one more integer, and at least 115 layers to use two more integers, so I think it's reasonable), and computing the shift for a layer cannot anymore be as simple as 5*layer.

BitVec.prototype.getshiftor = function(mask, shift) {
	var toshift = shift & 31;
	var ret = this.data[shift>>5] >>> (toshift);
	if (toshift) {
		ret |= this.data[(shift>>5)+1] << (32 - toshift);
	}
	return ret & mask;
}

BitVec.prototype.ishiftor = function(mask, shift) {
	var toshift = shift&31;
	var low = mask << toshift;
	this.data[shift>>5] |= low;
	if (toshift) {
		var high = mask >> (32 - toshift);
		this.data[(shift>>5)+1] |= high;
	}
}

BitVec.prototype.ishiftclear = function(mask, shift) {
	var toshift = shift & 31;
	var low = mask << toshift;
	this.data[shift>>5] &= ~low;
	if (toshift){
		var high = mask >> (32 - (shift & 31));
		this.data[(shift>>5)+1] &= ~high;
	}
}


// Comparisons of bit sets
// =======================

BitVec.prototype.equals = function(other) {
	// if (this.data.length !== other.data.length) // this function is only used twice on objects that are guarenteed to be the same size
	// 	return false;
	for (var i = 0; i < this.data.length; ++i) {
		if (this.data[i] !== other.data[i])
			return false;
	}
	return true;
}

BitVec.prototype.iszero = function() {
	for (var i = 0; i < this.data.length; ++i) {
		if (this.data[i])
			return false;
	}
	return true;
}

BitVec.prototype.bitsSetInArray = function(arr) { // are the bits in 'this' a subset of the bits in 'arr'?
	for (var i = 0; i < this.data.length; ++i) {
		if ((this.data[i] & arr[i]) !== this.data[i]) {
			return false;
		}
	}
	return true;
}

BitVec.prototype.bitsClearInArray = function(arr) {
	for (var i = 0; i < this.data.length; ++i) {
		if (this.data[i] & arr[i]) {
			return false;
		}
	}
	return true;
}

BitVec.prototype.anyBitsInCommon = function(other) {
	return !this.bitsClearInArray(other.data);
}

BitVec.prototype.forEachBitSet = function(func)
{
	for (var i=0; i<this.data.length; i++)
	{
		var bits = this.data[i]
		for (k=0; bits != 0; k++)
		{
			if (bits & 1)
			{
				func((i<<5)+k)
			}
			bits >>>= 1
		}
	}
}
