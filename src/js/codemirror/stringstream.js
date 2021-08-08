/*
 Code extracted from codemirror/codemirror.js that is used for parsing and is the only reason why PuzzleScript player had to include codemirror.
 */

function CodeMirrorStringStream(string, tabSize)
{
	this.pos = this.start = 0;
	this.string = string;
	this.tabSize = tabSize || 8;
	this.lastColumnPos = this.lastColumnValue = 0;
	this.lineStart = 0;
}

CodeMirrorStringStream.prototype = {
eol: function() {return this.pos >= this.string.length},
sol: function() {return this.pos == this.lineStart},
peek: function() {return this.string.charAt(this.pos) || undefined},
next: function()
{
	if (this.pos < this.string.length)
		return this.string.charAt(this.pos++)
},
eat: function(match)
{
	var ch = this.string.charAt(this.pos)
	if (typeof match == "string")
		var ok = ch == match
	else
		var ok = ch && (match.test ? match.test(ch) : match(ch));
	if (ok)
	{
		++this.pos;
		return ch;
	}
},
eatWhile: function(match)
{
	var start = this.pos
	while (this.eat(match)) { }
	return this.pos > start
},
skipToEnd: function() { this.pos = this.string.length },
skipTo: function(ch)
{
	const found = this.string.indexOf(ch, this.pos)
	if (found > -1)
	{
		this.pos = found
		return true
	}
},
match: function(pattern, consume, caseInsensitive)
{
	if (typeof pattern == "string")
	{
		var cased = (str) => (caseInsensitive ? str.toLowerCase() : str)
		var substr = this.string.substr(this.pos, pattern.length)
		if (cased(substr) == cased(pattern))
		{
			if (consume !== false)
				this.pos += pattern.length
			return true
		}
	}
	else
	{
		var match = this.string.slice(this.pos).match(pattern)
		if (match && match.index > 0) return null
		if (match && consume !== false)
			this.pos += match[0].length
		return match
	}
}
}
