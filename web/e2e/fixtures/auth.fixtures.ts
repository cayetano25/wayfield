export const TEST_USERS = {
  owner: {
    email: 'owner@e2e.wayfield.test',
    password: 'Testing!2024',
    firstName: 'Alex',
    lastName: 'Rivera',
  },
  admin: {
    email: 'admin@e2e.wayfield.test',
    password: 'Testing!2024',
    firstName: 'Jordan',
    lastName: 'Alvarez',
  },
  staff: {
    email: 'staff@e2e.wayfield.test',
    password: 'Testing!2024',
    firstName: 'Sam',
    lastName: 'Chen',
  },
  leader: {
    email: 'leader@e2e.wayfield.test',
    password: 'Testing!2024',
    firstName: 'Sarah',
    lastName: 'Kim',
  },
  participant: {
    email: 'participant@e2e.wayfield.test',
    password: 'Testing!2024',
    firstName: 'Maria',
    lastName: 'Santos',
  },
} as const

export const TEST_WORKSHOP = {
  title: 'Natural Light & Portraiture 2025',
  joinCode: 'MEADOW2025',
  sessions: {
    wildlife: 'Wildlife at Dawn',
    goldenHour: 'Golden Hour Composition',
    compositionConflict: 'Composition Theory', // overlaps Golden Hour
    postProcessing: 'Post-Processing Workshop',
  },
} as const
