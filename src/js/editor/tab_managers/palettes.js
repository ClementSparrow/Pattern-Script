
PaletteWidget = function(container, item_def)
{
	this.colors = []
	this.z = 0

	const colorspaces = {
		rg: { w:   1, v: [0, 0, 0]}, // xyz = rgb => no rotation
		gb: { w: 0.5, v: [0.5, 0.5, 0.5]}, // xyz = gbr 120° rotation (cos 60°=1/2, sin 60°=√3/2) around diagonal [1,1,1] of length √3
		// bg: { w: 0.7071067812, v: [0, -0.7071067812, 0]}, // xyz = bg-r -90° rotation (cos -45°=√2/2, sin -45°=-√2/2) around diagonal g
		br: { w:-0.5, v: [0.5, 0.5, 0.5]}, // xyz = brg 240° rotation (cos 120°=-1/2, sin 120°=√3/2) around diagonal of length √3
		// hsb:{ w: 0.888073834, v: [-0.3250575837, 0.3250575837, 0]}, // transforms the cube's diagonal (1,1,1)/√3 into x so the rotation axis is the cross product of these two vectors, (1,-1,0)/√3, which has norm √2/√3 = sin(Ω) so cos(Ω)=1/√3 (since Ω<90°) and sin(Ω)=2sin(Ω/2)cos(Ω/2) so 2/3 = 4sin^2(Ω/2)(1-sin^2(Ω/2)) (replacing sin^2 with 1-cos^2 would give the same expression with cosines instead of sines) hence x^2-x+1/6=0 with x=sin^2(Ω/2) (or cos^2) => ∆=1/3, x=(1±1/√3)/2 => sin(Ω/2) = √((1-1/√3)/2), cos(Ω/2) = √((1+1/√3)/2)
		hsb: { w: 0.8804762392398382, v: [ -0.27984814235734057, 0.364705199662564, 0.11591689596228216 ] }, // like above but with additionnal 7.5° rotation along the z axis
	}

	this.colorspace_buttons = make_HTML('div', {classes:['colorspace_buttons']})
	for (const [label, quaternion] of Object.entries(colorspaces))
	{
		this.colorspace_buttons.appendChild(make_HTML('button', {
			attr: {type: 'button'},
			text: label,
			events: {
				click: (e) => this.setActiveColorSpace(label, quaternion),
				mouseenter: (e) => this.changeColorSpace(quaternion),
				mouseleave: (e) => this.changeColorSpace(colorspaces[this.active_colorspace]),
			},
		}))
	}
	container.appendChild(this.colorspace_buttons)

	this.colorpicker_canvas = make_HTML('canvas', {
		attr: {width: 256, height: 256},
		events: {click: e => this.addColor(this.color_from_space(e.offsetX, e.offsetY, this.z))}
	})
	container.appendChild(this.colorpicker_canvas)

	this.zbar_canvas = make_HTML('canvas', {
		attr: {width: 16, height: 256},
		events: {mousedown: e => this.start_zdrag(e)}
	})
	container.appendChild(this.zbar_canvas)

	this.sprite_canvas = make_HTML('canvas', {style: {width: '256px', height: '256px'}})
	container.appendChild(this.sprite_canvas)

	this.setActiveColorSpace('rg', colorspaces['rg'], 1)
}

// WIP TODO:
// - move colors around with drag and drop or click
// - change this.z by directly clicking in the zbar
// - add rrggbb field to enter color directly as hex value
// - add copy/paste options for colors and palettes
// - allow to use the palette in the sprite editors of the Sprites tab

PaletteWidget.prototype = {

	color_from_space: function(x, y, z)
	{
		const base = [0,1,2].map(c => 127.5 + (x-127.5)*this.x_color[c] + (127.5-y)*this.y_color[c])
		// 0 < base[c]+(z-127.5)*z_color[c] < 255
		// => -base[c] < (z-127.5)*z_color[c] < 255 - base[c]
		// => 127.5 - base[c]/z_color[c] < z < 127.5 + (255 - base[c])/z_color[c] if z_color[c] > 0
		//    127.5 + (255 - base[c])/z_color[c] < z < 127.5 - base[c]/z_color[c] if z_color[c] < 0
		const min_z = Math.max(  0, ...base.map( (v,c) => 127.5 + ((this.z_color[c]<0 ? 255 : 0)-v)/this.z_color[c]))
		const max_z = Math.min(255, ...base.map( (v,c) => 127.5 + ((this.z_color[c]<0 ? 0 : 255)-v)/this.z_color[c]))
		const new_z = (1-z/255)*min_z + max_z*z/255
		return base.map( (v,c) => v+(new_z-127.5)*this.z_color[c])
	},

	addColor: function(color)
	{
		this.colors.push(color)
		this.sprite_editor.content.content.palette.push('rgb('+color.join(',')+')')
		this.sprite_editor.content.glyphSelectedIndex = this.colors.length - 1
		this.sprite_editor.resize_canvas()
		this.redraw()
		this.onChangeContent()
	},

	setActiveColorSpace: function(name, quaternion, dt)
	{
		this.active_colorspace = name
		this.colorspace_buttons.querySelectorAll('button').forEach(b => (b.innerText == name) ? b.classList.add('selected') : b.classList.remove('selected'))
		this.changeColorSpace(quaternion, dt)
	},

	changeColorSpace: function(q, dt)
	{
		this.quaternion_goal = q
		this.quaternion_start = this.quaternion_current || q
		this.dt = dt || 0
		this.lastframe_timestamp = null
		this.updateColorSpace(null)
	},

	updateColorSpace: function(timestamp)
	{
		const dot = (u,v) => u[0]*v[0] + u[1]*v[1] + u[2]*v[2]
		const scal = (a,u) => u.map(c => a*c)
		const sum = (u,v) => [u[0]+v[0], u[1]+v[1], u[2]+v[2]]
		const sub = (u,v) => [u[0]-v[0], u[1]-v[1], u[2]-v[2]]
		const cross = (u,v) => [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
		const conj = (q) => ({ w: q.w, v: scal(-1, q.v) })
		const mult = (p, q) => ({
			w: p.w*q.w - dot(p.v, q.v),
			v: sub( sum(scal(p.w,q.v), scal(q.w,p.v)), cross(p.v, q.v) )
		})
		const normalize = (p) => { const l = Math.sqrt(p.w*p.w + dot(p.v, p.v)); return (Math.abs(l) < 0.0001) ? p : {w: p.w/l, v: scal(1/l, p.v) } }

		let q = this.quaternion_goal
		if (this.dt < 1)
		{
			const diff = mult(this.quaternion_goal, conj(this.quaternion_start))
			const theta0 = Math.acos(diff.w)*2
			const theta = (theta0 > Math.PI) ? theta0 - 2*Math.PI : theta0
			if (Math.abs(theta) > 0.0001 )
			{
				q = mult({ w: Math.cos(theta*this.dt/2), v: scal(Math.sin(theta*this.dt/2)/Math.sin(theta0/2), diff.v)}, this.quaternion_start)
			}
			// q = normalize({ // nlerp
			// 	w: t1*this.quaternion_start.w + t2*this.quaternion_goal.w,
			// 	v: sum(scal(t1, this.quaternion_start.v), scal(t2, this.quaternion_goal.v)),
			// })
		}
		this.quaternion_current = q

		this.x_color = mult( conj(q), mult({w:0, v:[1,0,0]}, q) ).v
		this.y_color = mult( conj(q), mult({w:0, v:[0,1,0]}, q) ).v
		this.z_color = mult( conj(q), mult({w:0, v:[0,0,1]}, q) ).v

		// rescale to fit the whole cube projection in the canvas
		this.color_scale = Math.max(...Array.from(cartesian_product([-1,1], [-1,1], [-1,1])).map( (u) => Math.max(Math.abs(dot(this.x_color,u)), Math.abs(dot(this.y_color,u)))))
		this.x_color = scal(this.color_scale, this.x_color)
		this.y_color = scal(this.color_scale, this.y_color)
		this.z_color = scal(this.color_scale, this.z_color)
		
		this.redraw()

		if (this.dt < 1)
		{
			window.requestAnimationFrame(ts => this.updateColorSpace(ts))
			if (this.lastframe_timestamp !== null)
			{
				this.dt = Math.min(1, this.dt + (timestamp - this.lastframe_timestamp)/450 ) // ms
			}
			this.lastframe_timestamp = timestamp
		}
		else
		{
			this.lastframe_timestamp = null
			this.dt = 1
		}
	},

	drawField: function(canvas, color_func)
	{
		const ctx = canvas.getContext('2d')
		ctx.fillStyle = 'black'
		const [w, h] = [canvas.width, canvas.height]
		ctx.fillRect(0, 0, w, h)
		const image_data = ctx.getImageData(0, 0, w, h)
		const pixels = image_data.data
		for (let y=0, i=0; y<h; ++y)
		{
			for (let x=0; x<w; ++x, i+=4)
			{
				const color = color_func(x, y, this.z)
				if (color.some(c => (c<=-0.5) || (c>255.5)))
					continue
				pixels[i  ] = color[0]
				pixels[i+1] = color[1]
				pixels[i+2] = color[2]
				pixels[i+3] = 255
			}
		}
		ctx.putImageData(image_data, 0, 0)
	},

	drawMark: function(canvas, pos, fill_color, stroke_color)
	{
		const ctx = canvas.getContext('2d')
		ctx.fillStyle = fill_color
		ctx.fillRect(pos[0]-5, pos[1]-5, 10, 10)
		ctx.strokeStyle = stroke_color
		ctx.strokeRect(pos[0]-5, pos[1]-5, 10, 10)
	},

	redraw: function()
	{
		this.drawField(this.colorpicker_canvas, (x,y,z) => this.color_from_space(x,y,z))
		this.drawField(this.zbar_canvas, (x,y,z) => this.z_color.map(c => c*(255-y)) )
		this.drawMark(this.zbar_canvas, [this.zbar_canvas.width/2, 255-this.z], 'white', 'black')
		const s = this.color_scale*this.color_scale
		for (const [r,g,b] of this.colors)
		{
			const color_string = 'rgb('+r+','+g+','+b+')'
			const [r2, g2, b2] = [r-127.5, g-127.5, b-127.5]
			const screen_coords = [
				127.5 + (this.x_color[0]*r2 + this.x_color[1]*g2 + this.x_color[2]*b2)/s,
				127.5 + (this.y_color[0]*r2 + this.y_color[1]*g2 + this.y_color[2]*b2)/s,
				127.5 + (this.z_color[0]*r2 + this.z_color[1]*g2 + this.z_color[2]*b2)/s,
			]
			this.drawMark(this.colorpicker_canvas, [screen_coords[0], 255 - screen_coords[1]], color_string, 'black')
			this.drawMark(this.zbar_canvas, [this.zbar_canvas.width, 255 - screen_coords[2]], color_string, 'black')
		}
	},

	start_zdrag: function(event)
	{
		const dy = event.pageY - window.scrollY - this.zbar_canvas.getBoundingClientRect().top - 255 + this.z
		if (Math.abs(dy) > 5)
			return false
		this.drag_zbar = this.z
		
		const zdrag = (e) =>
		{
			this.z = clamp(0, this.drag_zbar + event.pageY - e.pageY, 255)
			this.redraw()
			return true
		}
		const end_zdrag = (e) => {
			document.removeEventListener('mousemove', zdrag)
			zdrag(e)
			this.drag_zbar = null
			this.redraw()
			return true
		}
		document.addEventListener('mousemove', zdrag, false)
		document.addEventListener('mouseup', end_zdrag, {once:true})
		return true
	},

	finalize: function(item_def)
	{
		this.sprite_editor = new SpriteEditor(this.sprite_canvas, 6, 6, [])
		this.sprite_editor.resize_canvas()
		this.redraw()
	},

	toDef: function(widget)
	{
		return this.colors.map( (color) => '#' + color.map(c => ('00'+c.toString(16)).slice(-2)).join(''))
	},

	sameItems: function(item1, item2)
	{
		return item1 == item2
	},

}


function PalettesTabManager(html_list)
{
	ListTabManager.call(this, html_list, 'palettes', 'Palette', PaletteWidget)
	this.sprites_connected = {}
	game_def.palettes = {}
	this.addNewBlankPaletteWidget('default_palette') // WIP TODO: this should only be done if we're loading a blank project
}
PalettesTabManager.prototype = Object.create(ListTabManager.prototype)

PalettesTabManager.prototype.addNewBlankPaletteWidget = function(name)
{
	this.addNewWidget({ name: name||'', })
}

PalettesTabManager.prototype.widgetContentChanged = function(name_field, widget)
{
	const palette_name = name_field.value
	if (palette_name.length == 0)
		return
	const palette = widget.toDef()
	game_def.palettes[palette_name] = palette // WIP TODO: be sure that the name is not duplicated
	// WIP TODO: change the palette in all the widgets that use it, notably the sprite widgets
	const sprites = this.sprites_connected[palette_name]
	if (sprites !== undefined)
	{
		for (const sprite of sprites) sprite.updatePalette(palette)
	}
	// WIP TODO: recompile the sprite transformations for the objects that use this palette
}

PalettesTabManager.prototype.onRemoveWidget = function(widget, name)
{
	// TODO
}

PalettesTabManager.prototype.connectSprite = function(widget, palette_name)
{
	if (palette_name in this.sprites_connected)
	{
		this.sprites_connected[palette_name].push(widget)
	}
	else
	{
		this.sprites_connected[palette_name] = [widget]
	}
	return game_def.palettes[palette_name]
}

PalettesTabManager.prototype.disconnectSprite = function(widget, palette_name)
{
	const list = this.sprites_connected[palette_name]
	if (list === undefined)
		return
	const index = list.indexOf(widget)
	if (index >= 0)
		list.splice(index, 1)
}