<?php

namespace Database\Factories;

use App\Models\Workshop;
use Illuminate\Database\Eloquent\Factories\Factory;

class SessionFactory extends Factory
{
    public function definition(): array
    {
        $startAt = $this->faker->dateTimeBetween('+1 month', '+3 months');
        $endAt = (clone $startAt)->modify('+2 hours');

        return [
            'workshop_id' => Workshop::factory(),
            'track_id' => null,
            'title' => $this->faker->sentence(4),
            'description' => $this->faker->paragraph(),
            'start_at' => $startAt->format('Y-m-d H:i:s'),
            'end_at' => $endAt->format('Y-m-d H:i:s'),
            'location_id' => null,
            'location_type' => null,
            'location_notes' => null,
            'capacity' => null,
            'delivery_type' => 'in_person',
            'virtual_participation_allowed' => false,
            'meeting_platform' => null,
            'meeting_url' => null,
            'meeting_instructions' => null,
            'meeting_id' => null,
            'meeting_passcode' => null,
            'notes' => null,
            'is_published' => false,
            // Access-control fields — defaults match the column defaults in the migration.
            'session_type' => 'standard',
            'publication_status' => 'draft',
            'participant_visibility' => 'visible',
            'enrollment_mode' => 'self_select',
            'requires_separate_entitlement' => false,
            'selection_opens_at' => null,
            'selection_closes_at' => null,
        ];
    }

    public function forWorkshop(int $workshopId): static
    {
        return $this->state(['workshop_id' => $workshopId]);
    }

    /**
     * Dual-write is_published and publication_status for transition compatibility.
     */
    public function published(): static
    {
        return $this->state([
            'is_published' => true,
            'publication_status' => 'published',
        ]);
    }

    public function withCapacity(int $capacity): static
    {
        return $this->state(['capacity' => $capacity]);
    }

    public function virtual(): static
    {
        return $this->state([
            'delivery_type' => 'virtual',
            'meeting_url' => 'https://meet.example.com/test-session',
        ]);
    }

    public function virtualWithoutUrl(): static
    {
        return $this->state([
            'delivery_type' => 'virtual',
            'meeting_url' => null,
        ]);
    }

    public function hybrid(): static
    {
        return $this->state([
            'delivery_type' => 'hybrid',
            'virtual_participation_allowed' => true,
            'meeting_url' => 'https://meet.example.com/hybrid-session',
        ]);
    }

    public function hybridWithoutVirtualParticipation(): static
    {
        return $this->state([
            'delivery_type' => 'hybrid',
            'virtual_participation_allowed' => false,
            'meeting_url' => null,
        ]);
    }

    // ─── Access-control states ────────────────────────────────────────────────

    public function standard(): static
    {
        return $this->state([
            'session_type' => 'standard',
            'publication_status' => 'published',
            'is_published' => true,
            'participant_visibility' => 'visible',
            'enrollment_mode' => 'self_select',
        ]);
    }

    public function addon(): static
    {
        return $this->state([
            'session_type' => 'addon',
            'publication_status' => 'published',
            'is_published' => true,
            'participant_visibility' => 'hidden',
            'enrollment_mode' => 'organizer_assign_only',
        ]);
    }

    public function hidden(): static
    {
        return $this->state([
            'publication_status' => 'published',
            'is_published' => true,
            'participant_visibility' => 'hidden',
            'enrollment_mode' => 'organizer_assign_only',
        ]);
    }

    public function organizerOnly(): static
    {
        return $this->state([
            'publication_status' => 'published',
            'is_published' => true,
            'participant_visibility' => 'visible',
            'enrollment_mode' => 'organizer_assign_only',
        ]);
    }

    public function draft(): static
    {
        return $this->state([
            'publication_status' => 'draft',
            'is_published' => false,
        ]);
    }

    public function atCapacity(int $capacity = 1): static
    {
        return $this->state(['capacity' => $capacity]);
    }
}
