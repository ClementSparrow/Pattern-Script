
function CommandsSet()
{
	BitVec.call(this, 13) // todo
	this.message = null
	this.nb_commands = 0
}
CommandsSet.prototype = Object.create(BitVec.prototype)

// DO NOT CHANGE THE ORDER OF COMMANDS
CommandsSet.commandwords = [ 'cancel', 'restart', 'again', 'win', 'checkpoint', 'sfx0', 'sfx1', 'sfx2', 'sfx3', 'sfx4', 'sfx5', 'sfx6', 'sfx7', 'sfx8', 'sfx9', 'sfx10', 'message' ]
CommandsSet.command_keys = {}
CommandsSet.commandwords.forEach( (word, index) => { CommandsSet.command_keys[word] = index} )

CommandsSet.prototype.is_command = function(word)
{
	return CommandsSet.command_keys.hasOwnProperty(word)
}

CommandsSet.prototype.addCommand = function(command)
{
	const key = CommandsSet.command_keys[command]
	if (this.get(key))
		return
	this.ibitset(key)
	this.nb_commands++
}

CommandsSet.prototype.setMessage = function(msg_text)
{
	this.message = msg_text
	this.addCommand('message')
}

CommandsSet.prototype.reset = function()
{
	this.setZero()
	this.message = null
}

CommandsSet.prototype.get_representation = function()
{
	return CommandsSet.commandwords.filter( (k,i) => this.get(i) ).join(' ').replace('message', '(message, "'+this.message+'")')
}