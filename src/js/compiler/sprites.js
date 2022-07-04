function rectanglify(s)
{
	const w = Math.max(...s.map(l => l.length))
	return s.map( l => l + '.'.repeat(w-l.length) )
}

function spriteMatrixTextLinesToArrays(dat)
{
	return dat.map(
		function(line)
		{
			const row = []
			for (let j = 0; j < line.length; j++)
			{
				const ch = line.charAt(j)
				row.push( (ch == '.') ? -1 : ch )
			}
			return row
		}
	)
}

function compileSprites(state)
{
	function expand(expansion_def, expansion)
	{
		if ( ! Array.isArray(expansion_def) )
			return expansion_def
		const [tag_index, fromset, toset] = expansion_def
		let tag_is_expanded_as = expansion[tag_index]
		if (tag_is_expanded_as === undefined) tag_is_expanded_as = 'right'
		return toset[fromset.indexOf(tag_is_expanded_as)]
	}
	function expand_direction(expansion_def, expansion)
	{
		return absolutedirs.indexOf(expand(expansion_def, expansion))
	}

	for (const [expansion_data, source_type, transforms] of state.sprites_to_compile)
	{
		for (const [object_index, [source_id, expansion]] of expansion_data)
		{
			let object = state.identifiers.objects[object_index]
			let sprite, offset
			switch (source_type)
			{
				case 0: // sprite in code
					sprite = state.sprites_in_code[source_id]
					offset = [0, 0]
					break
				case 1: // copy from object
					const source_object = state.identifiers.objects[source_id]
					sprite = Array.from( source_object.spritematrix )
					offset = Array.from( source_object.sprite_offset )
					break
			}
			for (const parts of transforms)
			{
				let f = (m) => m // default to identity function
				switch (parts[0])
				{
					case '|':
						{
							f = ( m => m.map( l => l.split('').reverse().join('') ) )
							sprite = rectanglify(sprite)
							break
						}
					case '-':
						{
							f = ( m => Array.from(m).reverse() )
							break
						}
					case 'shift':
						{
							if (sprite.length === 0)
								continue
							const shift_direction = expand_direction(parts[1], expansion)
							const sprite_size = shift_direction % 2 ? sprite[0].length : sprite.length
							const delta = (parts.length < 3
								? 1
								: parseInt(expand(parts[2], expansion)) % sprite_size)
							f = ([
									(m => [ ...Array.from(m.slice(delta)), ...Array.from(m.slice(0, delta)) ]), // up
									(m => Array.from(m, l => l.slice(-delta) + l.slice(0, -delta))), // right
									(m => [ ...Array.from(m.slice(-delta)), ...Array.from(m.slice(0, -delta)) ]), // down
									(m => Array.from(m, l => l.slice(delta) + l.slice(0, delta))) // left
								])[shift_direction]
							sprite = rectanglify(sprite)
						}
						break
					case 'rot':
						{
							if (sprite.length === 0)
								continue
							const ref_direction = expand_direction(parts[1], expansion)
							const to_direction = expand_direction(parts[2], expansion)
							const angle = (4 + to_direction - ref_direction) % 4 // clockwise
							f = ([
									( m => Array.from(m) ), // 0°
									( m => Array.from(m[0], (ch,col) => m.map( row => row[col] ).reverse().join('')) ), // 90°
									( m => Array.from(m, l => l.split('').reverse().join('') ).reverse() ), // 180°
									( m => Array.from(m[0], (ch,col) => m.map( row => row[col] ).join('')).reverse() ) // 270°
								])[angle]
							sprite = rectanglify(sprite)
						}
						break
					case 'translate':
						{
							const translate_direction = expand_direction(parts[1], expansion)
							const amount = parseInt(expand(parts[2], expansion))
							const v = ([
									[ 0,-1], // up
									[ 1, 0], // right
									[ 0, 1], // down
									[-1, 0] // left
								])[translate_direction]
							offset[0] += v[0]*amount
							offset[1] += v[1]*amount
						}
						break
					default:
				}
				sprite = f(sprite)
			}
			object.spritematrix = sprite
			object.sprite_offset = offset
		}
	}

//	Compile sprites for all objects
	for (const o of state.identifiers.objects)
	{
		if ( (o.palette.length == 0) && (o.colors.length == 0) )
		{
			// TODO: since this can generate errors that could be highlighted, it should be done in the parser
			// TODO: We may want to silently use transparency in that case, considering how frequent it is to use transparent markers in PuzzleScript...
			logError(['no_palette_in_object', o.name], state.identifiers.lineNumbers[o.identifier_index])
			o.colors = ['#ff00ffff']
		}
		if (o.spritematrix.length === 0)
		{
			o.spritematrix = Array.from( {length: sprite_height}, () => (new Array(sprite_width).fill(0)) )
		}
		else
		{
			o.spritematrix = spriteMatrixTextLinesToArrays(o.spritematrix)
		}
	}
}
