'use strict'

// time
const dt = 0.1
let time = 0
const timeScale = 10

// drone characterization
let drone
const size = 0.075
const mass = 0.03

// drone movement
const g = 9.8
const maxThrustPerMotor = 0.015
const minPwm = 128
const maxPwm = 255

// screen
let updater, screen

window.onload = () => {
	screen = new Screen()
	resetSimulation()
	screen.clear()
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
		update(dt)
		screen.draw()
		if (drone.isFinished()) {
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
	screen.clear()
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

function update(dt) {
	const newTime = time + dt
	drone.update(dt)
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

class Drone {
	accel = 0
	speed = 3
	pos = 40
	target = 10
	propulsion = new Propulsion()
	dragComputer = new DragComputer()

	update(dt) {
		this.accel = this.computeAccel()
		const newSpeed = this.speed + dt * this.accel
		const newPos = this.pos + dt * newSpeed
		this.pos = newPos
		this.speed = newSpeed
		console.log(`time: ${time.toFixed(1)}`)
		console.log(`speed: ${this.speed}`)
		console.log(`accel: ${this.accel}`)
	}

	computeAccel() {
		return 0
	}

	draw() {
		const x = timeScale * time
		console.log(`plotting at ${x}`)
		screen.plot2d([x, screen.first - this.accel - 1], 'red')
		screen.plot2d([x, screen.second - this.speed - 1], 'green')
		screen.plot2d([x, screen.third - this.pos - 1], 'blue')
	}

	computeSegments() {
		const dist = size / 2
		const coord1 = [-dist, -dist, 0]
		const coord2 = [dist, -dist, 0]
		const coord3 = [dist, dist, 0]
		const coord4 = [-dist, dist, 0]
		const endpoints = [coord1, coord2, coord3, coord4]
		return endpoints.map(endpoint => this.convertEndpoint(endpoint))
	}

	convertEndpoint(endpoint) {
		const inertial = this.convertToInertial(endpoint)
		const start = sum(this.pos, scale(inertial, this.brokenSeparation))
		const end = sum(start, inertial)
		return [start, end]
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

	isFinished() {
		return false
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
	intervals = [[5, 192], [2, 187], [6, 193], [2, 128]]
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

	computeForce(dt) {
		const pwm = this.computePwm(dt)
		const value = (pwm - minPwm) / (maxPwm - minPwm)
		const thrust = maxThrustPerMotor * g * value
		return 4 * thrust
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
	updater = null
	fontSize = 16
	first = 0
	second = 0
	third = 0

	constructor() {
		const canvas = document.getElementById('canvas')
		this.width = canvas.width
		this.height = canvas.height
		this.first = this.height / 3
		this.second = 2 * this.height / 3
		this.third = this.height
		this.ctx = canvas.getContext('2d');
		this.ctx.font = '16px sans-serif'
		this.ctx.clearRect(0, 0, this.width, this.height)
	}

	clear() {
		this.ctx.clearRect(0, 0, this.width, this.height)
		this.line2d([0, this.first], [this.width, this.first], 'red')
		this.line2d([0, this.second], [this.width, this.second], 'green')
	}

	draw() {
		this.ctx.clearRect(0, 0, this.width, this.fontSize)
		this.ctx.fillText(`accel = ${drone.accel.toFixed(1)}`, 50, this.fontSize - 1)
		this.ctx.clearRect(0, this.first, this.width, this.fontSize)
		this.ctx.fillText(`speed = ${drone.speed.toFixed(1)}`, 50, this.first + this.fontSize - 1)
		this.ctx.clearRect(0, this.second, this.width, this.fontSize)
		this.ctx.fillText(`pos = ${drone.pos.toFixed(1)}`, 50, this.second + this.fontSize - 1)
		drone.draw()
	}

	plot2d([x, y], color) {
		return this.line2d([x, y], [x+1, y+1], color)
	}

	line2d([x1, y1], [x2, y2], color) {
		this.ctx.strokeStyle = color
		this.ctx.beginPath()
		this.ctx.moveTo(x1, y1)
		this.ctx.lineTo(x2, y2)
		this.ctx.stroke()
	}
}
