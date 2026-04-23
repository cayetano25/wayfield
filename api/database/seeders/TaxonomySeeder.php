<?php

namespace Database\Seeders;

use App\Models\TaxonomyCategory;
use App\Models\TaxonomySubcategory;
use App\Models\TaxonomySpecialization;
use App\Models\TaxonomyTagGroup;
use App\Models\TaxonomyTag;
use Illuminate\Database\Seeder;

class TaxonomySeeder extends Seeder
{
    public function run(): void
    {
        $this->seedCategories();
        $this->seedTagGroups();
    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    /** Slugify for category/subcategory/specialization names. */
    private function slug(string $name, int $maxLength = 200): string
    {
        $slug = strtolower($name);
        $slug = preg_replace('/[^a-z0-9\s-]/', '', $slug);
        $slug = preg_replace('/[\s]+/', '-', trim($slug));
        $slug = preg_replace('/-+/', '-', $slug);
        return substr($slug, 0, $maxLength);
    }

    /** Slugify for tag values: spaces → underscores. */
    private function tagValue(string $label): string
    {
        $value = strtolower($label);
        $value = preg_replace('/[^a-z0-9\s_]/', '', $value);
        $value = preg_replace('/[\s]+/', '_', trim($value));
        $value = preg_replace('/_+/', '_', $value);
        return substr($value, 0, 100);
    }

    // ─────────────────────────────────────────────────────────────
    // Category / Subcategory / Specialization tree
    // ─────────────────────────────────────────────────────────────

    private function seedCategories(): void
    {
        foreach ($this->taxonomyTree() as $sortOrder => $categoryData) {
            $category = TaxonomyCategory::updateOrCreate(
                ['slug' => $this->slug($categoryData['name'], 100)],
                [
                    'name'       => $categoryData['name'],
                    'sort_order' => $sortOrder,
                    'is_active'  => true,
                ]
            );

            foreach ($categoryData['subcategories'] as $subSort => $subData) {
                $subSlug = $this->slug($subData['name'], 150);

                $subcategory = TaxonomySubcategory::updateOrCreate(
                    ['category_id' => $category->id, 'slug' => $subSlug],
                    [
                        'name'       => $subData['name'],
                        'sort_order' => $subSort,
                        'is_active'  => true,
                    ]
                );

                foreach ($subData['specializations'] as $specSort => $specName) {
                    TaxonomySpecialization::updateOrCreate(
                        ['subcategory_id' => $subcategory->id, 'slug' => $this->slug($specName, 200)],
                        [
                            'name'       => $specName,
                            'sort_order' => $specSort,
                            'is_active'  => true,
                        ]
                    );
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Tag groups + tags
    // ─────────────────────────────────────────────────────────────

    private function seedTagGroups(): void
    {
        foreach ($this->tagGroupsData() as $sortOrder => $groupData) {
            $group = TaxonomyTagGroup::updateOrCreate(
                ['key' => $groupData['key']],
                [
                    'label'           => $groupData['label'],
                    'description'     => $groupData['description'] ?? null,
                    'allows_multiple' => $groupData['allows_multiple'],
                    'is_active'       => true,
                    'sort_order'      => $sortOrder,
                ]
            );

            foreach ($groupData['tags'] as $tagSort => $tagLabel) {
                TaxonomyTag::updateOrCreate(
                    ['tag_group_id' => $group->id, 'value' => $this->tagValue($tagLabel)],
                    [
                        'label'      => $tagLabel,
                        'sort_order' => $tagSort,
                        'is_active'  => true,
                    ]
                );
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Taxonomy data — 14 categories
    // ─────────────────────────────────────────────────────────────

    private function taxonomyTree(): array
    {
        return [
            // 0
            [
                'name' => 'Arts & Visuals',
                'subcategories' => [
                    [
                        'name' => 'Photography',
                        'specializations' => [
                            'Portrait Photography',
                            'Landscape & Nature Photography',
                            'Street & Documentary Photography',
                            'Wedding & Event Photography',
                            'Commercial & Product Photography',
                            'Wildlife Photography',
                            'Astrophotography',
                            'Architectural Photography',
                            'Fine Art Photography',
                            'Sports & Action Photography',
                            'Film Photography & Darkroom',
                            'Photo Editing & Post-Processing',
                            'Drone Photography',
                            'Mobile Photography',
                            'Macro Photography',
                        ],
                    ],
                    [
                        'name' => 'Painting & Drawing',
                        'specializations' => [
                            'Watercolor',
                            'Oil Painting',
                            'Acrylic Painting',
                            'Gouache',
                            'Life Drawing & Figure Drawing',
                            'Portrait Drawing',
                            'Charcoal & Graphite',
                            'Ink & Brush',
                            'Plein Air Painting',
                            'Abstract Painting',
                            'Botanical Illustration',
                            'Manga & Comic Art',
                        ],
                    ],
                    [
                        'name' => 'Digital Art & Illustration',
                        'specializations' => [
                            'Digital Illustration',
                            'Character Design',
                            'Concept Art',
                            'Motion Graphics',
                            'UI/UX Design',
                            'Photo Manipulation',
                            '3D Modeling & Rendering',
                            'Pixel Art',
                            'Generative Art & AI Art',
                        ],
                    ],
                    [
                        'name' => 'Sculpture & Ceramics',
                        'specializations' => [
                            'Wheel Throwing',
                            'Hand Building',
                            'Glazing & Firing',
                            'Sculpture',
                            'Bronze Casting',
                            'Stone Carving',
                            'Mold Making',
                        ],
                    ],
                    [
                        'name' => 'Printmaking & Mixed Media',
                        'specializations' => [
                            'Screen Printing',
                            'Linocut & Woodblock',
                            'Etching & Engraving',
                            'Collage',
                            'Book Arts',
                            'Zine Making',
                        ],
                    ],
                    [
                        'name' => 'Film & Video',
                        'specializations' => [
                            'Filmmaking & Directing',
                            'Cinematography',
                            'Video Editing',
                            'Documentary Making',
                            'Animation',
                            'Short Film Production',
                        ],
                    ],
                    [
                        'name' => 'Graphic Design',
                        'specializations' => [
                            'Brand Identity',
                            'Typography',
                            'Poster & Print Design',
                            'Packaging Design',
                            'Layout & Editorial Design',
                        ],
                    ],
                ],
            ],
            // 1
            [
                'name' => 'Performing Arts',
                'subcategories' => [
                    [
                        'name' => 'Music',
                        'specializations' => [
                            'Guitar',
                            'Piano & Keyboards',
                            'Drums & Percussion',
                            'Bass Guitar',
                            'Violin & Strings',
                            'Voice & Singing',
                            'Songwriting',
                            'Music Production & DAW',
                            'Music Theory',
                            'Jazz Improvisation',
                            'Classical Technique',
                            'Electronic Music',
                            'Music Mixing & DJing',
                        ],
                    ],
                    [
                        'name' => 'Dance',
                        'specializations' => [
                            'Ballet',
                            'Contemporary & Modern',
                            'Hip-Hop & Street Dance',
                            'Salsa & Latin',
                            'Ballroom & Swing',
                            'Tap Dance',
                            'Traditional & Cultural Dance',
                            'Aerial & Acrobatics',
                            'Dance Fitness',
                        ],
                    ],
                    [
                        'name' => 'Theater & Acting',
                        'specializations' => [
                            'Scene Study',
                            'Improvisation',
                            'Voice & Speech',
                            'Stage Combat',
                            'Musical Theater',
                            'Clowning & Physical Theater',
                            'Audition Technique',
                        ],
                    ],
                    [
                        'name' => 'Comedy & Spoken Word',
                        'specializations' => [
                            'Stand-Up Comedy',
                            'Improv Comedy',
                            'Sketch Writing',
                            'Slam Poetry',
                            'Storytelling Performance',
                        ],
                    ],
                ],
            ],
            // 2
            [
                'name' => 'Writing & Storytelling',
                'subcategories' => [
                    [
                        'name' => 'Fiction Writing',
                        'specializations' => [
                            'Novel Writing',
                            'Short Story',
                            'Science Fiction & Fantasy',
                            'Mystery & Thriller',
                            'Romance Writing',
                            'Horror Writing',
                            'Literary Fiction',
                            'Flash Fiction',
                        ],
                    ],
                    [
                        'name' => 'Non-Fiction Writing',
                        'specializations' => [
                            'Memoir & Personal Essay',
                            'Journalism & Reportage',
                            'Travel Writing',
                            'Food & Lifestyle Writing',
                            'Literary Non-Fiction',
                            'Essay Writing',
                        ],
                    ],
                    [
                        'name' => 'Screenwriting & Playwriting',
                        'specializations' => [
                            'Feature Screenplay',
                            'Television Writing',
                            'Stage Play',
                            'Short Film Script',
                            'Pilot Writing',
                        ],
                    ],
                    [
                        'name' => 'Poetry',
                        'specializations' => [
                            'Traditional Forms',
                            'Free Verse',
                            'Spoken Word Poetry',
                            'Lyric Essay',
                        ],
                    ],
                    [
                        'name' => 'Content & Copywriting',
                        'specializations' => [
                            'Blogging & Content Strategy',
                            'SEO Writing',
                            'Copywriting',
                            'Newsletter Writing',
                            'Social Media Writing',
                        ],
                    ],
                ],
            ],
            // 3
            [
                'name' => 'Digital & Tech',
                'subcategories' => [
                    [
                        'name' => 'Software Development',
                        'specializations' => [
                            'Web Development',
                            'Mobile Development',
                            'Backend Engineering',
                            'DevOps & Cloud',
                            'Game Development',
                            'Embedded Systems',
                            'Open Source Contribution',
                        ],
                    ],
                    [
                        'name' => 'Data & AI',
                        'specializations' => [
                            'Data Science & Analytics',
                            'Machine Learning',
                            'Deep Learning & Neural Networks',
                            'Natural Language Processing',
                            'Computer Vision',
                            'AI for Creatives',
                            'Data Visualization',
                        ],
                    ],
                    [
                        'name' => 'Cybersecurity',
                        'specializations' => [
                            'Ethical Hacking & Pentesting',
                            'Network Security',
                            'Security Engineering',
                            'Digital Forensics',
                            'Privacy & Compliance',
                        ],
                    ],
                    [
                        'name' => 'Product & UX',
                        'specializations' => [
                            'Product Management',
                            'UX Research',
                            'Prototyping & Wireframing',
                            'Usability Testing',
                            'Design Systems',
                        ],
                    ],
                    [
                        'name' => 'No-Code & Automation',
                        'specializations' => [
                            'No-Code App Building',
                            'Workflow Automation',
                            'Spreadsheet & Database Tools',
                            'AI Prompt Engineering',
                        ],
                    ],
                ],
            ],
            // 4
            [
                'name' => 'Business & Entrepreneurship',
                'subcategories' => [
                    [
                        'name' => 'Startups & Entrepreneurship',
                        'specializations' => [
                            'Idea Validation',
                            'Business Model Design',
                            'Fundraising & Pitching',
                            'Early-Stage Growth',
                            'Founder Storytelling',
                        ],
                    ],
                    [
                        'name' => 'Marketing & Branding',
                        'specializations' => [
                            'Brand Strategy',
                            'Content Marketing',
                            'Social Media Marketing',
                            'Email Marketing',
                            'Paid Advertising',
                            'SEO & Organic Growth',
                            'Community Building',
                        ],
                    ],
                    [
                        'name' => 'Finance & Investment',
                        'specializations' => [
                            'Personal Finance',
                            'Investing Fundamentals',
                            'Real Estate Investing',
                            'Accounting for Small Business',
                            'Crypto & Web3',
                        ],
                    ],
                    [
                        'name' => 'Sales & Negotiation',
                        'specializations' => [
                            'B2B Sales',
                            'Negotiation Tactics',
                            'Consultative Selling',
                            'Sales Leadership',
                        ],
                    ],
                    [
                        'name' => 'Leadership & Management',
                        'specializations' => [
                            'Team Leadership',
                            'Executive Presence',
                            'Change Management',
                            'Coaching & Mentoring',
                            'People Management',
                        ],
                    ],
                ],
            ],
            // 5
            [
                'name' => 'Wellness & Mindfulness',
                'subcategories' => [
                    [
                        'name' => 'Meditation & Mindfulness',
                        'specializations' => [
                            'Guided Meditation',
                            'Mindfulness-Based Stress Reduction',
                            'Transcendental Meditation',
                            'Vipassana',
                            'Breathwork',
                            'Body Scan & Somatic Awareness',
                        ],
                    ],
                    [
                        'name' => 'Yoga',
                        'specializations' => [
                            'Hatha Yoga',
                            'Vinyasa Flow',
                            'Yin Yoga',
                            'Restorative Yoga',
                            'Ashtanga Yoga',
                            'Kundalini Yoga',
                            'Yoga Nidra',
                            'Prenatal Yoga',
                            'Yoga for Athletes',
                        ],
                    ],
                    [
                        'name' => 'Mental Health & Emotional Wellbeing',
                        'specializations' => [
                            'Stress & Anxiety Management',
                            'Grief & Loss',
                            'Self-Compassion',
                            'Emotional Intelligence',
                            'Nervous System Regulation',
                            'Trauma-Informed Practices',
                        ],
                    ],
                    [
                        'name' => 'Nutrition & Holistic Health',
                        'specializations' => [
                            'Plant-Based Nutrition',
                            'Intuitive Eating',
                            'Gut Health',
                            'Ayurveda',
                            'Functional Nutrition',
                        ],
                    ],
                    [
                        'name' => 'Sleep & Recovery',
                        'specializations' => [
                            'Sleep Hygiene',
                            'Recovery for Athletes',
                            'Nervous System Reset',
                        ],
                    ],
                ],
            ],
            // 6
            [
                'name' => 'Outdoor & Adventure',
                'subcategories' => [
                    [
                        'name' => 'Hiking & Backpacking',
                        'specializations' => [
                            'Day Hiking',
                            'Multi-Day Backpacking',
                            'Leave No Trace',
                            'Navigation & Orienteering',
                            'Alpine Hiking',
                        ],
                    ],
                    [
                        'name' => 'Climbing',
                        'specializations' => [
                            'Rock Climbing — Beginner',
                            'Trad Climbing',
                            'Sport Climbing',
                            'Bouldering',
                            'Ice Climbing',
                            'Indoor Climbing',
                        ],
                    ],
                    [
                        'name' => 'Water Sports',
                        'specializations' => [
                            'Kayaking',
                            'Surfing',
                            'SUP (Stand-Up Paddleboarding)',
                            'Whitewater Rafting',
                            'Scuba Diving',
                            'Snorkeling',
                            'Sailing',
                        ],
                    ],
                    [
                        'name' => 'Cycling & Mountain Biking',
                        'specializations' => [
                            'Road Cycling',
                            'Mountain Biking',
                            'Bikepacking',
                            'Gravel Riding',
                        ],
                    ],
                    [
                        'name' => 'Wilderness Skills & Survival',
                        'specializations' => [
                            'Wilderness First Aid',
                            'Fire Making & Primitive Skills',
                            'Wild Food Foraging',
                            'Shelter Building',
                        ],
                    ],
                    [
                        'name' => 'Winter Sports',
                        'specializations' => [
                            'Skiing',
                            'Snowboarding',
                            'Ski Touring & Backcountry',
                            'Snowshoeing',
                        ],
                    ],
                ],
            ],
            // 7
            [
                'name' => 'Culinary',
                'subcategories' => [
                    [
                        'name' => 'Cooking Techniques',
                        'specializations' => [
                            'Knife Skills & Kitchen Fundamentals',
                            'Baking & Pastry',
                            'Fermentation & Preservation',
                            'Plant-Based Cooking',
                            'Grilling & BBQ',
                            'Sous Vide & Modern Techniques',
                            'Weeknight Cooking',
                        ],
                    ],
                    [
                        'name' => 'Cuisine by Region',
                        'specializations' => [
                            'Italian Cuisine',
                            'Japanese Cuisine',
                            'Mexican Cuisine',
                            'Indian Cuisine',
                            'French Cuisine',
                            'Middle Eastern Cuisine',
                            'Korean Cuisine',
                            'Southeast Asian Cuisine',
                        ],
                    ],
                    [
                        'name' => 'Drinks & Beverages',
                        'specializations' => [
                            'Coffee & Espresso',
                            'Wine Tasting & Pairing',
                            'Cocktail Mixing',
                            'Tea & Fermented Drinks',
                            'Beer Brewing',
                            'Natural Wine',
                        ],
                    ],
                    [
                        'name' => 'Food Business',
                        'specializations' => [
                            'Food Styling & Photography',
                            'Recipe Development',
                            'Food Entrepreneurship',
                        ],
                    ],
                ],
            ],
            // 8
            [
                'name' => 'Crafts & Maker',
                'subcategories' => [
                    [
                        'name' => 'Textile & Fiber Arts',
                        'specializations' => [
                            'Knitting',
                            'Crochet',
                            'Weaving',
                            'Embroidery & Needlework',
                            'Macramé',
                            'Natural Dyeing',
                            'Sewing & Garment Making',
                            'Quilting',
                        ],
                    ],
                    [
                        'name' => 'Woodworking & Making',
                        'specializations' => [
                            'Hand Tool Woodworking',
                            'Power Tool Woodworking',
                            'Furniture Making',
                            'Wood Turning',
                            'CNC & Laser Cutting',
                            'Spoon Carving',
                        ],
                    ],
                    [
                        'name' => 'Jewelry & Metalwork',
                        'specializations' => [
                            'Silversmithing',
                            'Metalsmithing',
                            'Beading & Wire Wrapping',
                            'Enameling',
                            'Blacksmithing',
                        ],
                    ],
                    [
                        'name' => 'Leatherwork & Bookbinding',
                        'specializations' => [
                            'Leather Crafting',
                            'Bookbinding',
                            'Journal Making',
                        ],
                    ],
                    [
                        'name' => 'Candles, Soap & Home',
                        'specializations' => [
                            'Candle Making',
                            'Soap Making',
                            'Natural Cosmetics',
                            'Resin Crafts',
                        ],
                    ],
                ],
            ],
            // 9
            [
                'name' => 'Education & Teaching',
                'subcategories' => [
                    [
                        'name' => 'Pedagogy & Curriculum',
                        'specializations' => [
                            'Lesson Planning',
                            'Differentiated Instruction',
                            'Project-Based Learning',
                            'Assessment & Feedback',
                            'Inclusive Education',
                        ],
                    ],
                    [
                        'name' => 'Workshop Facilitation',
                        'specializations' => [
                            'Group Facilitation',
                            'Workshop Design',
                            'Hosting Retreats',
                            'Virtual Facilitation',
                            'Facilitation for Inclusion',
                        ],
                    ],
                    [
                        'name' => 'Online Teaching & Course Creation',
                        'specializations' => [
                            'Online Course Design',
                            'Video Production for Educators',
                            'Learning Management Systems',
                            'Monetizing Knowledge',
                        ],
                    ],
                    [
                        'name' => 'Early Childhood & Youth Education',
                        'specializations' => [
                            'Early Childhood Development',
                            'Arts in Education',
                            'STEM for Youth',
                            'Social-Emotional Learning',
                        ],
                    ],
                ],
            ],
            // 10
            [
                'name' => 'Lifestyle & Hobbies',
                'subcategories' => [
                    [
                        'name' => 'Games & Puzzles',
                        'specializations' => [
                            'Chess',
                            'Board Games & Strategy',
                            'Escape Room Design',
                            'Dungeons & Dragons & Tabletop RPG',
                        ],
                    ],
                    [
                        'name' => 'Collecting & Appreciation',
                        'specializations' => [
                            'Antiquing & Vintage',
                            'Record Collecting',
                            'Sports Memorabilia',
                        ],
                    ],
                    [
                        'name' => 'Home & Garden',
                        'specializations' => [
                            'Interior Design Basics',
                            'Container Gardening',
                            'Permaculture',
                            'Floral Design & Arrangement',
                            'Bee Keeping',
                            'Mushroom Growing',
                        ],
                    ],
                    [
                        'name' => 'Astrology, Tarot & Spiritual Practices',
                        'specializations' => [
                            'Astrology',
                            'Tarot Reading',
                            'Numerology',
                            'Energy Healing',
                        ],
                    ],
                    [
                        'name' => 'Languages',
                        'specializations' => [
                            'Spanish',
                            'French',
                            'Mandarin',
                            'Japanese',
                            'Italian',
                            'American Sign Language',
                            'Conversational Language Practice',
                        ],
                    ],
                ],
            ],
            // 11
            [
                'name' => 'Personal Development',
                'subcategories' => [
                    [
                        'name' => 'Productivity & Focus',
                        'specializations' => [
                            'Time Management',
                            'Deep Work',
                            'Systems & Tools',
                            'ADHD & Executive Function',
                            'Digital Minimalism',
                        ],
                    ],
                    [
                        'name' => 'Communication & Relationships',
                        'specializations' => [
                            'Public Speaking',
                            'Difficult Conversations',
                            'Conflict Resolution',
                            'Romantic Relationships',
                            'Parenting',
                            'Friendship & Social Skills',
                        ],
                    ],
                    [
                        'name' => 'Career & Life Transitions',
                        'specializations' => [
                            'Career Change',
                            'Job Search & Interviewing',
                            'Building a Portfolio',
                            'Mid-Life Transitions',
                            'Retirement Planning',
                        ],
                    ],
                    [
                        'name' => 'Creativity & Creative Blocks',
                        'specializations' => [
                            'Overcoming Creative Blocks',
                            'Building a Creative Practice',
                            'Journaling',
                            'Creative Confidence',
                        ],
                    ],
                ],
            ],
            // 12
            [
                'name' => 'Fitness & Movement',
                'subcategories' => [
                    [
                        'name' => 'Strength & Conditioning',
                        'specializations' => [
                            'Olympic Weightlifting',
                            'Powerlifting',
                            'Functional Strength',
                            'Kettlebell Training',
                            'Bodyweight Training',
                            'HIIT',
                        ],
                    ],
                    [
                        'name' => 'Martial Arts & Combat Sports',
                        'specializations' => [
                            'Brazilian Jiu-Jitsu',
                            'Boxing',
                            'Muay Thai',
                            'Judo',
                            'Karate',
                            'Capoeira',
                            'Wrestling',
                        ],
                    ],
                    [
                        'name' => 'Mind-Body Movement',
                        'specializations' => [
                            'Pilates',
                            'Tai Chi',
                            'Qigong',
                            'Feldenkrais Method',
                            'Alexander Technique',
                        ],
                    ],
                    [
                        'name' => 'Running & Endurance',
                        'specializations' => [
                            '5K & 10K Training',
                            'Half & Full Marathon',
                            'Trail Running',
                            'Triathlon',
                            'Endurance Nutrition',
                        ],
                    ],
                    [
                        'name' => 'Sport-Specific Skill',
                        'specializations' => [
                            'Tennis',
                            'Golf',
                            'Basketball Skills',
                            'Soccer Skills',
                            'Swimming',
                            'Volleyball',
                        ],
                    ],
                ],
            ],
            // 13
            [
                'name' => 'Community & Culture',
                'subcategories' => [
                    [
                        'name' => 'Social Justice & Advocacy',
                        'specializations' => [
                            'Anti-Racism & Equity',
                            'Climate Advocacy',
                            'Disability Justice',
                            'LGBTQ+ Allyship',
                            'Community Organizing',
                        ],
                    ],
                    [
                        'name' => 'Heritage & Cultural Traditions',
                        'specializations' => [
                            'Indigenous Knowledge & Land Practices',
                            'Oral History & Storytelling Traditions',
                            'Traditional Music & Dance',
                            'Folk Crafts & Heritage Arts',
                        ],
                    ],
                    [
                        'name' => 'Environmental & Sustainability',
                        'specializations' => [
                            'Zero-Waste Living',
                            'Urban Farming',
                            'Sustainable Fashion',
                            'Climate Solutions',
                            'Rewilding & Ecology',
                        ],
                    ],
                    [
                        'name' => 'Civic & Community',
                        'specializations' => [
                            'Civic Engagement',
                            'Community Leadership',
                            'Volunteer Coordination',
                            'Neighborhood & Local Action',
                        ],
                    ],
                ],
            ],
        ];
    }

    // ─────────────────────────────────────────────────────────────
    // Tag groups data — 16 groups
    // ─────────────────────────────────────────────────────────────

    private function tagGroupsData(): array
    {
        return [
            // 0
            [
                'key'             => 'skill_level',
                'label'           => 'Skill Level',
                'allows_multiple' => false,
                'tags'            => [
                    'Beginner-Friendly',
                    'Some Experience Needed',
                    'Intermediate',
                    'Advanced',
                    'Mixed Levels Welcome',
                    'All Levels',
                ],
            ],
            // 1
            [
                'key'             => 'format',
                'label'           => 'Format',
                'allows_multiple' => false,
                'tags'            => [
                    'Hands-On',
                    'Lecture & Discussion',
                    'Demo & Watch',
                    'Critique & Feedback',
                    'Retreat',
                    'Intensive',
                    'Drop-In',
                    'Cohort',
                    'Self-Paced',
                    'One-on-One',
                ],
            ],
            // 2
            [
                'key'             => 'duration',
                'label'           => 'Duration',
                'allows_multiple' => false,
                'tags'            => [
                    '1–2 Hours',
                    'Half Day',
                    'Full Day',
                    'Weekend',
                    'Multi-Day (3–5 Days)',
                    'Week-Long',
                    'Multi-Week',
                    'Ongoing / Recurring',
                ],
            ],
            // 3
            [
                'key'             => 'audience',
                'label'           => 'Audience',
                'allows_multiple' => true,
                'tags'            => [
                    'Adults',
                    'Teens',
                    'Kids',
                    'Families',
                    'Seniors',
                    'Professionals',
                    'Students',
                    'Hobbyists',
                    'Caregivers',
                    'LGBTQ+ Community',
                    'Women & Non-Binary',
                    'BIPOC Community',
                    'People with Disabilities',
                    'Remote Workers',
                    'Parents',
                ],
            ],
            // 4
            [
                'key'             => 'group_size',
                'label'           => 'Group Size',
                'allows_multiple' => false,
                'tags'            => [
                    'Solo (1-on-1)',
                    'Very Small (2–5)',
                    'Small (6–12)',
                    'Medium (13–25)',
                    'Large (26–50)',
                    'Very Large (50+)',
                ],
            ],
            // 5
            [
                'key'             => 'experience_style',
                'label'           => 'Experience Style',
                'allows_multiple' => true,
                'tags'            => [
                    'Relaxed & Casual',
                    'Structured & Focused',
                    'Creative & Experimental',
                    'Challenging & Rigorous',
                    'Community-Oriented',
                    'Solo Practice',
                    'Playful & Fun',
                    'Reflective & Introspective',
                    'High Energy',
                    'Slow & Mindful',
                ],
            ],
            // 6
            [
                'key'             => 'environment',
                'label'           => 'Environment',
                'allows_multiple' => false,
                'tags'            => [
                    'Indoors',
                    'Outdoors',
                    'Online',
                    'Hybrid (In-Person + Online)',
                    'Studio',
                    'Nature / Wilderness',
                    'Urban Setting',
                    'Private Home',
                    'Community Space',
                ],
            ],
            // 7
            [
                'key'             => 'goals_outcomes',
                'label'           => 'Goals & Outcomes',
                'allows_multiple' => true,
                'tags'            => [
                    'Build a Skill',
                    'Complete a Project',
                    'Meet Like-Minded People',
                    'Relax & Recharge',
                    'Boost Confidence',
                    'Explore a New Interest',
                    'Advance Professionally',
                    'Heal & Recover',
                    'Have Fun',
                    'Get Certified',
                    'Create Something Tangible',
                    'Be Inspired',
                ],
            ],
            // 8
            [
                'key'             => 'accessibility',
                'label'           => 'Accessibility',
                'allows_multiple' => true,
                'tags'            => [
                    'Wheelchair Accessible',
                    'Low Sensory',
                    'Neurodivergent-Friendly',
                    'Interpreter Available',
                    'Closed Captioning',
                    'Service Animals Welcome',
                    'Child Care Available',
                    'Sliding Scale Pricing',
                    'Free or Subsidized',
                    'Mobility-Friendly',
                    'Vision-Accessible Materials',
                ],
            ],
            // 9
            [
                'key'             => 'price_model',
                'label'           => 'Price Model',
                'allows_multiple' => false,
                'tags'            => [
                    'Free',
                    'Pay What You Can',
                    'Fixed Price',
                    'Subscription Included',
                    'Tiered Pricing',
                    'Deposit Required',
                ],
            ],
            // 10
            [
                'key'             => 'pace',
                'label'           => 'Pace',
                'allows_multiple' => false,
                'tags'            => [
                    'Go at Your Own Pace',
                    'Instructor-Led Pacing',
                    'Fast-Paced',
                    'Slow & Deliberate',
                ],
            ],
            // 11
            [
                'key'             => 'content_intensity',
                'label'           => 'Content Intensity',
                'allows_multiple' => false,
                'tags'            => [
                    'Light & Introductory',
                    'Moderate',
                    'Deep Dive',
                    'Immersive',
                    'Bootcamp-Style',
                ],
            ],
            // 12
            [
                'key'             => 'delivery_features',
                'label'           => 'Delivery Features',
                'allows_multiple' => true,
                'tags'            => [
                    'Materials Included',
                    'Take-Home Project',
                    'Certificate of Completion',
                    'Recorded Sessions Available',
                    'Community Forum Access',
                    'One-on-One Feedback',
                    'Group Critiques',
                    'Guest Speakers',
                    'Field Trip or Excursion',
                    'Meals Included',
                    'Lodging Included',
                    'Live Q&A',
                    'Workbook or Resources Included',
                ],
            ],
            // 13
            [
                'key'             => 'venue_type',
                'label'           => 'Venue Type',
                'allows_multiple' => false,
                'tags'            => [
                    'Studio or Workshop Space',
                    'Gallery or Museum',
                    'Coworking Space',
                    'Community Center',
                    'Retreat Center',
                    'Park or Public Space',
                    'Private Residence',
                    'Restaurant or Kitchen',
                    'University or School',
                    'Online Platform',
                    'Hotel or Conference Center',
                    'Farm or Ranch',
                    'Winery or Brewery',
                ],
            ],
            // 14
            [
                'key'             => 'booking_context',
                'label'           => 'Booking Context',
                'allows_multiple' => false,
                'tags'            => [
                    'Drop-In Friendly',
                    'Advance Registration Required',
                    'Invite Only',
                    'Series — Register for All',
                    'Series — Attend Any Session',
                    'Corporate or Team Booking',
                    'Private Group Available',
                ],
            ],
            // 15
            [
                'key'             => 'seasonality',
                'label'           => 'Seasonality',
                'allows_multiple' => false,
                'tags'            => [
                    'Year-Round',
                    'Spring',
                    'Summer',
                    'Fall / Autumn',
                    'Winter',
                    'Holiday Season',
                ],
            ],
        ];
    }
}
