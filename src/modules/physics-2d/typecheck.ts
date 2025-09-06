import type { PhysicsReadPort, PhysicsWritePort, PhysicsStepPort } from '../../engine/core'
import type { PhysicsService } from './types'

const _read: PhysicsReadPort  = {} as PhysicsService
const _write: PhysicsWritePort = {} as PhysicsService
const _step: PhysicsStepPort   = {} as PhysicsService