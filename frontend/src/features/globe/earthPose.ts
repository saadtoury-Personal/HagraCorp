import { Matrix4, Quaternion, Vector3 } from 'three'
import { earthFrame } from '../../lib/earthOrientation'

const world = new Matrix4()
// The Earth model is a cube-sphere whose prime meridian faces -z with north on +y: columns (prime, north, east-ish).
const model = new Matrix4().makeBasis(new Vector3(0, 0, -1), new Vector3(0, 1, 0), new Vector3(1, 0, 0)).transpose()
const prime = new Vector3()
const axis = new Vector3()
const third = new Vector3()

/** Earth's real orientation in the Moon frame at time `day` (tilted axis, real sidereal turn), as a quaternion for the Earth model. */
export function earthQuaternion(day: number, out: Quaternion) {
  const f = earthFrame(day)
  prime.set(...f.prime)
  axis.set(...f.axis)
  third.crossVectors(prime, axis)
  world.makeBasis(prime, axis, third).multiply(model)
  return out.setFromRotationMatrix(world)
}
