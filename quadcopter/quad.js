'use strict'

// time
const dt = 0.1
let time = 0

// drone characterization
let drone
const size = 0.075
const mass = 0.03

// drone movement
const g = 9.8
let gravity = [0, 0, -g]
const maxThrustPerMotor = 0.15
const minPwm = 128
const maxPwm = 255

// screen
let updater, screen

window.onload = () => {
	screen = new Screen()
	resetSimulation()
	screen.draw()
	if (getCheckbox('autorun')) {
		console.log('running')
		run()
	}
	document.getElementById('run').onclick = run
	document.getElementById('pause').onclick = pause
	document.getElementById('reset').onclick = reset
}

function run() {
	drone.yaw = getDegrees('yaw')
	drone.pitch = getDegrees('pitch')
	drone.roll = getDegrees('roll')
	if (updater) return
	updater = window.setInterval(() => {
		update()
		screen.draw()
		if (drone.propulsion.isFinished()) {
			pause()
		}
	}, dt * 1000)
}

function pause() {
	if (!updater) return
	window.clearInterval(updater)
	updater = null
}

function reset() {
	pause()
	resetSimulation()
	screen.draw()
}

function resetSimulation() {
	console.log('resetting')
	time = 0
	drone = new Drone()
	console.log('reset')
}

function getDegrees(name) {
	return getParameter(name) * Math.PI / 180
}

function getParameter(name) {
	return parseFloat(document.getElementById(name).value)
}

function getCheckbox(name) {
	return document.getElementById(name).checked
}

function update() {
	const newTime = time + dt
	drone.update()
	screen.draw()
	time = newTime
}

function sum([x1, y1, z1], [x2, y2, z2]) {
	if (x1 === undefined) {
		throw Error(`Bad vector1 for sum: ${x1}`)
	}
	if (x2 === undefined) {
		throw Error(`Bad vector2 for sum: ${x2}`)
	}
	return [x1 + x2, y1 + y2, z1 + z2]
}

function scale([x, y, z], factor) {
	return [factor * x, factor * y, factor * z]
}

function display([x, y, z]) {
	return `[${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}]`
}

class Drone {
	pitch = 0.001 //Math.PI/8
	yaw = 0 //Math.PI/8
	roll = 0 //Math.PI/8
	pos = [0, 0, 0]
	speed = [0, 0, 0]
	accel = [0, 0, 0]
	propulsion = new Propulsion()
	dragComputer = new DragComputer()

	update() {
		this.accel = this.computeAccel()
		console.log(`speed: ${this.speed}`)
		const newSpeed = sum(scale(this.accel, dt), this.speed)
		const newPos = sum(scale(newSpeed, dt), this.pos)
		if (newPos[2] < 0) {
			newPos[2] = 0
			newSpeed[2] = 0
		}
		this.speed = newSpeed
		this.pos = newPos
	}

	computeAccel() {
		const accel = this.convertToInertial([0, 0, this.propulsion.computeAccel(dt)])
		const accelGrav = sum(accel, gravity)
		const drag = this.dragComputer.compute(this.speed)
		console.log(`drag: ${drag}`)
		const total = sum(accelGrav, drag)
		return total
	}

	draw() {
		const [c1, c2, c3, c4] = this.computeCoords()
		screen.line3d(c1, c3, 'blue')
		screen.line3d(c2, c4, 'blue')
		const accel = sum(this.pos, this.convertToInertial(this.accel))
		screen.line3d(this.pos, accel, 'red')
	}

	computeCoords() {
		const dist = size / 2
		const coord1 = [-dist, -dist, 0]
		const coord2 = [dist, -dist, 0]
		const coord3 = [dist, dist, 0]
		const coord4 = [-dist, dist, 0]
		return [coord1, coord2, coord3, coord4].map(vector => sum(this.pos, this.convertToInertial(vector)))
	}

	convertToInertial([x, y, z]) {
		const cy = Math.cos(this.yaw)
		const sy = Math.sin(this.yaw)
		const cp = Math.cos(-this.pitch)
		const sp = Math.sin(-this.pitch)
		const cr = Math.cos(this.roll)
		const sr = Math.sin(this.roll)
		const xp = x * cy*cp + y * (cy*sp*sr - sy*cr) + z * (cy*sp*cr + sy*sr)
		const yp = x * sy*cp + y * (sy*sp*sr - cy*cr) + z * (sy*sp*cr - cy*sr)
		const zp = - x * sp + y * (cp*sr) + z * (cp*cr)
		return [xp, yp, zp]
	}
}

class DragComputer {
	cd = 0.4
	density = 1.2
	area = size * size

	compute(speed) {
		const factor = -0.5 * this.density * this.cd * this.area / mass
		return scale(speed, factor)
	}
}

class Propulsion {
	intervals = [[5, 191], [2, 186], [5, 192], [1, 128]]
	currentInterval = 0
	pending = 0
	constructor() {
		this.computePending()
	}

	getInterval() {
		return this.intervals[this.currentInterval]
	}

	computePending() {
		const interval = this.getInterval()
		this.pending = interval[0] || 0
	}

	computeAccel(dt) {
		const pwm = this.computePwm(dt)
		const value = (pwm - minPwm) / (maxPwm - minPwm)
		const thrust = maxThrustPerMotor * value
		return 4 * thrust / mass
	}

	computePwm(dt) {
		this.pending -= dt
		if (this.pending < 0) {
			this.currentInterval += 1
			if (this.isFinished()) {
				return 0
			}
			this.computePending()
		}
		const interval = this.getInterval()
		return interval[1]
	}

	isFinished() {
		return this.currentInterval >= this.intervals.length
	}
}

class Screen {
	width = 0
	height = 0
	ctx = null
	raw = null
	updater = null
	fontSize = 16
	cameraPos = [0, -1, 1]
	cameraScale = 200

	constructor() {
		const canvas = document.getElementById('canvas');
		this.width = canvas.width
		this.height = canvas.height - this.fontSize
		this.ctx = canvas.getContext('2d');
		this.ctx.font = '16px sans-serif'
		this.ctx.clearRect(0, 0, this.width, this.height)
		//raw = ctx.getImageData(0, 0, width, height);
	}

	clear() {
	}

	draw() {
		this.ctx.clearRect(0, this.height, this.width, this.height + this.fontSize)
		this.ctx.clearRect(0, 0, this.width, this.height)
		//ctx.putImageData(raw, 0, 0);
		drone.draw()
		this.ctx.fillText(`t = ${time.toFixed(1)} s`, 100, this.height + this.fontSize - 1)
		this.ctx.fillText(`pos = ${display(drone.pos)}`, 300, this.height + this.fontSize - 1)
		this.ctx.fillText(`acc = ${display(drone.accel)}`, 500, this.height + this.fontSize - 1)
	}

	line3d(pos1, pos2, color) {
		const point1 = this.convert3d(pos1)
		const point2 = this.convert3d(pos2)
		this.line2d(point1, point2, color)
	}

	convert3d([vx, vy, vz]) {
		const x = this.cameraScale * (vx - this.cameraPos[0]) / (vy - this.cameraPos[1])
		const y = - this.cameraScale * (vz - this.cameraPos[2]) / (vy - this.cameraPos[1])
		return {x, y}
	}

	line2d(point1, point2, color) {
		this.ctx.strokeStyle = color
		this.ctx.beginPath()
		this.ctx.moveTo(this.width / 2 + point1.x, this.height / 2 + point1.y)
		this.ctx.lineTo(this.width / 2 + point2.x, this.height / 2 + point2.y)
		this.ctx.stroke()
	}
}

