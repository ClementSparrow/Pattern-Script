
// function to create easily HTML elements, that I put there because it's convenient
function make_HTML(element_type, options)
{
	const result = document.createElement(element_type)
	const { attr: attributes = {}, classes = [], style = {}, data = {}, events = {}, text, value } = options
	for (const [name, value] of Object.entries(attributes))
	{
		result.setAttribute(name, value)
	}
	result.classList.add(...classes)
	for (const [name, value] of Object.entries(data))
	{
		result.dataset[name] = value
	}
	if (value != undefined) result.value = value
	if (text !== undefined) result.innerText = text
	for (const [name, value] of Object.entries(style))
	{
		result.style[name] = value
	}
	for (const [name, callback] of Object.entries(events))
	{
		result.addEventListener(name, callback, false)
	}
	return result
}

function make_name_inputline(prompt, default_value, events, field_extra_attributes)
{
	const name_label = make_HTML('label', { text: prompt, attr: {required: ''}} )
	const name_field = make_HTML('input', {
		attr: Object.assign({type: 'text'}, field_extra_attributes || {}),
		value: default_value,
		events: events,
	})
	// WIP TODO: add a button to copy the name
	name_label.appendChild(name_field)
	return name_label
}

function ListTabManager(html_list, game_def_property, name, widget_type)
{
	this.name = game_def_property
	this.html_list = html_list
	this.game_def_property = game_def_property
	this.type_name = name
	this.widget_type = widget_type
	this.widgets = []
	this.widgets_by_name = {} // name to index

	html_list.classList.add('managed_widget_list')

	// Add 'create new item' button
	html_list.insertAdjacentElement('afterend', make_HTML('button', {
		attr: {type: 'button'},
		text: 'Create new '+this.type_name,
		events: { click: (e) => { this.addNewBlankWidget(); tabs.checkDirty() } },
	}))

	// to allow autocompletion of fields that ask for a name in this list
	this.names_datalist = make_HTML('datalist', {attr: {id: name.toLowerCase()+'_names'}})
	document.head.appendChild(this.names_datalist)
}

ListTabManager.prototype = {

	// Namespace management
	// ====================

	has_usable_name: function(widget_manager)
	{
		return (this.widgets_by_name[widget_manager.widget.name] === widget_manager)
	},

	name_is_free: function(name)
	{
		return (name !== undefined) && (name.length > 0) && ! (name in this.widgets_by_name)
	},

	free_name: function(widget_manager)
	{
		if ( ! this.has_usable_name(widget_manager) )
			return
		const name = widget_manager.widget.name
		delete game_def[this.game_def_property][name]
		delete this.widgets_by_name[name]
	},

	register_name: function(new_name, widget_manager)
	{
		if ( ! this.name_is_free(new_name) )
			return
		game_def[this.game_def_property][new_name] = widget_manager.widget.def
		this.widgets_by_name[new_name] = widget_manager
	},

	updateNamesList: function()
	{
		// update the datalist for name fields autocompletion
		this.names_datalist.innerText = ''
		for (const name of Object.keys(this.widgets_by_name))
		{
			this.names_datalist.appendChild( make_HTML('option', {attr: {value: name}}) )
		}
	},


	// Changes on list items
	// =====================

	addNewWidget: function(name, item_def)
	{

		const subwidget_container = make_HTML('div', {classes: ['list_widget']})
		const manager = new this.widget_type(subwidget_container, item_def)
		manager.onChangeContent = (w) => { this.widgetContentChanged(w); tabs.checkDirty() }
		manager.onChangeState   = (w) => { this.widgetStateChanged(w);   tabs.checkDirty() }
		manager.widget = { name: name, def: item_def, connected: {} } // "connected" should be removed for export
		this.widgets.push( manager.widget )

		this.register_name(name, manager)
		this.updateNamesList()

		const widget = document.createElement('li')

		// name widget
		widget.appendChild(
			make_name_inputline(
				this.type_name+' name:',
				name,
				{ change: (e) => this.renameWidget(manager, e.target.value) }
			)
		)

		// content widget
		widget.appendChild(subwidget_container)

		// item management buttons
		const widget_buttons = document.createElement('div')
		const buttons_def = [
			[ 'Delete', 'removeWidget' ],
			[ 'Copy',   'copyWidget' ],
		]
		for (const [button_label, button_callback] of buttons_def)
		{
			widget_buttons.appendChild(make_HTML('button', {
				text: button_label+' '+this.type_name,
				events: { click: (e) => this[button_callback](widget, manager) },
			}))
		}
		widget.appendChild(widget_buttons)

		this.html_list.appendChild(widget)

		manager.finalize(item_def)
	},

	renameWidget: function(widget_manager, new_name)
	{
		const widget = widget_manager.widget
		this.free_name(widget_manager)
		widget.name = new_name
		this.register_name(new_name, widget_manager)
		this.updateNamesList()
		tabs.checkDirty()
		// WIP TODO: recompile, because a name can have changed that was or has become used in the objects
	},

	// WIP TODO: the delete button should be grayed if the item is used, otherwise it can cause issues with live update
	removeWidget: function(html_widget, widget_manager)
	{
		const widget = widget_manager.widget
		this.html_list.removeChild(html_widget)
		this.free_name(widget_manager)
		this.onRemoveWidget(widget)
		this.updateNamesList()
		tabs.checkDirty()
		// no need to recompile here
	},


	// Tab Manager interface
	// =====================

	setContent: function(content)
	{
		this.html_list.textContent = ''
		game_def[this.game_def_property] = {}
		this.widgets = []
		this.widgets_by_name = {}
		for(const [item_name, item_def] of content)
			this.addNewWidget(item_name, item_def)
	},

	getContent: function()
	{
		return Array.from(this.widgets, (widget) => [widget.name, this.widget_type.prototype.deepCopy(widget.def)])
	},

	checkDirty: function(saved)
	{
		const current = this.getContent()
		if (saved.length != current.length)
			return true
		return saved.some(
			([name, widget], i) => (name != current[i][0])
								|| ! this.widget_type.prototype.sameItems(widget, current[i][1])
		)
	},

	setLoading: function() { },
	removeFocus: function() { },
	setLightMode: function(mode) { },
}
