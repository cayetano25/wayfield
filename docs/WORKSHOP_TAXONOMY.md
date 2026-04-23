# Workshop Taxonomy

## Purpose
Define the canonical three-level taxonomy (Category → Subcategory → Specialization) and
cross-cutting tag system for all Wayfield workshops. This taxonomy supports classification,
browsing, discovery, analytics, and future recommendation features across the platform.

This file is the authoritative source for taxonomy data used by:
- `WORKSHOP_TAXONOMY_CLAUDE_CODE_PROMPTS.md` (implementation guide)
- `TaxonomySeeder` in the Laravel API
- The workshop create/edit form taxonomy fields
- The public discovery/browse endpoint and page

---

## Design Principles

1. Categories are broad lifestyle, creative, and skill-building umbrellas — not hyper-specific verticals.
2. Every workshop has one primary category. Secondary category paths are supported for future cross-listing.
3. Subcategories are the most commonly searched groupings within a category.
4. Specializations are added only when a subcategory has enough inventory to justify them.
5. Tags absorb edge cases, niche themes, emerging formats, and cross-cutting attributes that span categories.
6. The taxonomy is stable at the category level. Subcategories and specializations may be extended via seeder updates without schema changes.

---

## Taxonomy Governance

- Review taxonomy usage monthly once discovery is live.
- Promote high-volume tags to specializations when traffic justifies it.
- Retire low-usage specializations that do not aid discovery.
- Maintain a synonym/alias map separately (future) so search is forgiving without fragmenting reporting.
- Do not create separate categories for every niche craft, software tool, or local experience type — use specializations or tags instead.

---

## Primary Categories for UI

Surface these 14 categories in the initial discovery UI, in this order:

1. Arts & Visuals
2. Performing Arts
3. Writing & Storytelling
4. Digital & Tech
5. Business & Entrepreneurship
6. Wellness & Mindfulness
7. Outdoor & Adventure
8. Culinary
9. Crafts & Maker
10. Education & Teaching
11. Lifestyle & Hobbies
12. Personal Development
13. Fitness & Movement
14. Community & Culture

**Recommended tighter launch set** (highest universal browse volume): Arts & Visuals, Culinary, Wellness & Mindfulness, Outdoor & Adventure, Business & Entrepreneurship, Digital & Tech, Fitness & Movement.

---

## Three-Level Taxonomy

### Arts & Visuals

| Subcategory | Specializations |
|---|---|
| Photography | Landscape, Long Exposure, Astrophotography, Portrait, Studio Lighting, Street Photography, Wildlife, Documentary, Mobile Photography, Editing & Retouching |
| Painting | Acrylic, Watercolor, Oil, Gouache, Abstract Painting |
| Drawing | Sketching, Figure Drawing, Perspective, Charcoal, Ink Illustration |
| Illustration | Editorial Illustration, Digital Illustration, Character Design, Concept Art, Children's Illustration |
| Printmaking | Screen Printing, Linocut, Woodcut, Etching, Monotype |
| Mixed Media | Collage, Journaling, Assemblage, Experimental Techniques, Found Materials |
| Sculpture | Clay Sculpting, Wire Sculpture, Paper Sculpture, Relief Sculpture, Installation Art |
| Craft Art | Calligraphy, Hand Lettering, Papercraft, Bookbinding, Zentangle |
| Digital Art | Procreate, Photoshop, Tablet Drawing, Generative Art, AI-Assisted Art |
| Comics & Manga | Manga Drawing, Storyboarding, Sequential Art, Character Development, Comic Inking |
| Ceramics & Pottery | Wheel Throwing, Handbuilding, Glazing, Surface Design, Raku |

---

### Performing Arts

| Subcategory | Specializations |
|---|---|
| Dance | Ballet, Hip-Hop, Contemporary, Salsa, Ballroom, Tap, African Dance, Improvisation |
| Music | Songwriting, Music Theory, Piano, Guitar, Drums, Voice, Beatmaking, Music Production |
| Theater & Acting | Improvisation, Scene Study, Character Work, Audition Prep, Monologues, Playwriting, Directing, Musical Theater |
| Performance Skills | Public Speaking, Stage Presence, Voice Projection, Movement for Performance, Comedy, Circus Arts |

---

### Writing & Storytelling

| Subcategory | Specializations |
|---|---|
| Creative Writing | Fiction, Poetry, Short Stories, Flash Fiction, Literary Fiction |
| Screenwriting | Feature Film, TV Writing, Writing for Streaming, Dialogue, Story Structure |
| Nonfiction Writing | Essay Writing, Memoir, Journalism, Personal Essay, Research Writing |
| Copywriting & Content | Advertising Copy, Social Media Writing, SEO Writing, Email Writing, Brand Voice |
| Publishing | Editing, Proofreading, Book Design, Self-Publishing, Writing Workflow |
| Storytelling | Narrative Design, Oral Storytelling, Podcast Storytelling, Personal Storytelling, Story Arc |
| Journaling | Bullet Journaling, Art Journaling, Reflective Writing, Prompt-Based Writing, Memory Keeping |

---

### Digital & Tech

| Subcategory | Specializations |
|---|---|
| Programming | Web Development, Python, JavaScript, Mobile Apps, APIs, Data Structures, Version Control, Testing & Debugging |
| Design | UI Design, UX Design, Design Systems, Figma, Interaction Design |
| Data & Analytics | Data Visualization, Excel, SQL, Business Intelligence, Dashboard Design |
| No-Code & Automation | Webflow, Zapier, Airtable, Notion, Workflow Automation |
| AI & Machine Learning | Prompt Engineering, AI Tools for Work, Machine Learning Basics, Generative AI, AI for Creativity |
| Cybersecurity | Privacy Basics, Secure Coding, Threat Awareness, Digital Safety, Identity Protection |
| Photography Tech | Camera Settings, Lighting Tech, Video Production, Color Management, File Workflow |

---

### Business & Entrepreneurship

| Subcategory | Specializations |
|---|---|
| Startup | Idea Validation, Lean Startup, Pitch Decks, Go-to-Market, Fundraising |
| Strategy | Business Models, Strategic Planning, Competitive Analysis, Operations, KPIs |
| Marketing | Brand Strategy, Content Marketing, SEO, Paid Ads, Email Marketing |
| Sales | Prospecting, Discovery Calls, Closing, Negotiation, CRM |
| Finance | Budgeting, Pricing, Bookkeeping, Cash Flow, Financial Planning |
| Leadership | Team Management, Decision-Making, Communication, Executive Presence, Change Management |
| Productivity | Time Management, Focus, Task Systems, Goal Setting, Personal Organization |
| Career Development | Interviewing, Resume Writing, Networking, Personal Branding, Portfolio Building |

---

### Wellness & Mindfulness

| Subcategory | Specializations |
|---|---|
| Meditation | Breath Awareness, Mindfulness, Loving-Kindness, Stress Reduction, Focus Training |
| Yoga | Hatha, Vinyasa, Yin, Restorative, Prenatal Yoga |
| Breathwork | Box Breathing, Somatic Breathwork, Relaxation, Energy Regulation, Nervous System Support |
| Stress Management | Burnout Prevention, Resilience, Sleep Support, Anxiety Management, Work-Life Balance |
| Self-Care | Journaling, Boundaries, Rest Practices, Reflection, Habit Building |
| Spirituality | Intuition, Ritual Design, Energy Practices, Conscious Living, Nature Connection |

---

### Outdoor & Adventure

| Subcategory | Specializations |
|---|---|
| Hiking | Day Hikes, Trail Skills, Navigation, Leave No Trace, Backpacking Basics |
| Camping | Tent Camping, Car Camping, Outdoor Cooking, Campcraft, Wilderness Safety |
| Water Activities | Kayaking, Canoeing, Paddleboarding, Snorkeling, Sailing Basics |
| Cycling | Road Cycling, Mountain Biking, Bike Maintenance, Gravel Riding, Urban Cycling |
| Survival Skills | Fire Building, Shelter Building, First Aid, Wilderness Preparedness, Outdoor Navigation |
| Nature & Wildlife | Birdwatching, Foraging, Nature Journaling, Wildlife Tracking, Ecology |

---

### Culinary

| Subcategory | Specializations |
|---|---|
| Cooking Basics | Knife Skills, Kitchen Fundamentals, Meal Prep, Pantry Planning, Recipe Reading |
| Baking | Bread Making, Cakes, Pastry, Cookies, Sourdough |
| Regional Cuisine | Italian, Mexican, Japanese, Thai, Mediterranean |
| Healthy Cooking | Plant-Based, Gluten-Free, Low-Sugar, Whole Foods, Family Meals |
| Entertaining | Dinner Parties, Plating, Wine Pairing, Charcuterie, Small-Plate Menus |
| Fermentation & Preservation | Pickling, Canning, Kimchi, Kombucha, Fermented Foods |
| Specialty Diets | Vegan, Vegetarian, Keto, Allergy-Friendly, High-Protein |

---

### Crafts & Maker

| Subcategory | Specializations |
|---|---|
| Sewing & Textiles | Sewing Basics, Pattern Making, Alterations, Embroidery, Quilting |
| Woodworking | Joinery, Furniture Making, Finishing, Hand Tools, Power Tools |
| Jewelry Making | Beading, Wire Wrapping, Metalwork, Resin Jewelry, Soldering |
| Leathercraft | Tooling, Bag Making, Wallet Making, Stitching, Dyeing |
| DIY Home Projects | Home Repair, Upcycling, Furniture Restoration, Decor Projects, Tool Safety |
| Paper Crafts | Origami, Scrapbooking, Card Making, Papercutting, Book Arts |
| 3D Making | 3D Printing, Laser Cutting, Model Making, Prototyping, Maker Tools |

---

### Education & Teaching

| Subcategory | Specializations |
|---|---|
| Teaching Practice | Lesson Planning, Classroom Facilitation, Active Learning, Assessment Design, Feedback Skills |
| Curriculum Design | Learning Outcomes, Course Design, Syllabus Design, Instructional Design, Learning Materials |
| Tutoring & Coaching | One-on-One Instruction, Study Skills, Homework Support, Test Prep, Academic Coaching |
| Adult Learning | Andragogy, Facilitation, Workshop Design, Peer Learning, Reflective Practice |
| Language Teaching | ESL, Pronunciation, Grammar, Conversation Practice, Vocabulary Building |
| Special Education | Accessibility, Differentiation, Inclusive Teaching, Learning Support, Universal Design |

---

### Lifestyle & Hobbies

Photography appears in both Arts & Visuals and Lifestyle & Hobbies intentionally. Use one canonical category as primary and the other as a secondary tag path to avoid duplicate browsing paths.

| Subcategory | Specializations |
|---|---|
| Gardening | Flower Gardening, Vegetable Gardening, Indoor Plants, Herb Gardens, Composting |
| Home & Living | Home Organization, Interior Styling, Decluttering, Minimalism, Seasonal Decorating |
| Pets & Animals | Pet Training, Animal Care, Dog Enrichment, Cat Care, Pet Photography |
| Games & Recreation | Board Games, Card Games, Puzzle Solving, Game Design, Trivia |
| Travel | Travel Planning, Packing, Cultural Etiquette, Solo Travel, City Exploration |
| Photography as Hobby | Street Photography, Nature Photography, Smartphone Photography, Photo Walks, Editing Basics |

---

### Personal Development

| Subcategory | Specializations |
|---|---|
| Goal Setting | Vision Setting, Planning, Accountability, Habit Tracking, Execution |
| Confidence | Self-Esteem, Public Presence, Assertiveness, Social Confidence, Self-Advocacy |
| Communication | Active Listening, Conflict Resolution, Boundaries, Difficult Conversations, Emotional Intelligence |
| Creativity | Brainstorming, Idea Generation, Creative Habits, Creative Blocks, Inspiration Practices |
| Mindset | Growth Mindset, Resilience, Motivation, Self-Discipline, Reframing |
| Life Skills | Adulting, Decision-Making, Money Habits, Routine Building, Self-Management |

---

### Fitness & Movement

| Subcategory | Specializations |
|---|---|
| Strength Training | Bodyweight Training, Weightlifting, Kettlebells, Mobility Prep, Form & Technique |
| Cardio | Running, HIIT, Dance Fitness, Low-Impact Cardio, Endurance Training |
| Flexibility & Mobility | Stretching, Mobility Work, Recovery, Warmups, Cooldowns |
| Mind-Body Movement | Pilates, Tai Chi, Qigong, Somatic Movement, Functional Movement |
| Sports Skills | Tennis, Soccer, Climbing, Swimming, Martial Arts |

---

### Community & Culture

Community & Culture may be merged into Personal Development or Lifestyle & Hobbies for a simpler v1, but keeping it separate is better for marketplace clarity as the platform grows.

| Subcategory | Specializations |
|---|---|
| Community Building | Facilitation, Group Dynamics, Networking, Civic Engagement, Volunteer Training |
| Culture & Heritage | Local History, Folk Arts, Traditions, Cultural Storytelling, Heritage Skills |
| Social Impact | Advocacy, Nonprofit Skills, Community Organizing, Fundraising, Impact Measurement |

---

## Cross-Cutting Tag Groups

Tags apply across all categories. Every workshop may have tags from multiple groups. Tags do not replace the category hierarchy — they enrich it for filtering, search, and recommendations.

For AI recommendations, the most valuable tag groups are: `skill_level`, `experience_style`, `duration`, `price_model`, `environment`, `booking_context`, and `seasonality`.

### Tag Group Definitions

| Key | Label | Allows Multiple | Values |
|---|---|---|---|
| `skill_level` | Skill Level | No (single-select) | Beginner, Beginner-Friendly, Intermediate, Advanced, All Levels |
| `format` | Format | No (single-select) | In-Person, Virtual, Hybrid, Self-Paced, Live Instruction |
| `duration` | Duration | No (single-select) | Single Session, Multi-Day, Weekend Workshop, Intensive, Retreat, Ongoing Series |
| `audience` | Audience | Yes (multi-select) | Adults, Kids, Teens, Seniors, Professionals, Creatives, Hobbyists |
| `group_size` | Group Size | No (single-select) | 1-on-1, Small Group, Large Group |
| `experience_style` | Experience Style | Yes (multi-select) | Hands-On, Lecture-Based, Guided Practice, Critique-Based, Collaborative, Immersive |
| `environment` | Environment | No (single-select) | Indoor, Outdoor, Studio-Based, On-Location, Travel-Based |
| `goals_outcomes` | Goals & Outcomes | Yes (multi-select) | Portfolio Building, Skill Development, Certification, Creative Exploration, Business Growth |
| `accessibility` | Accessibility | Yes (multi-select) | Wheelchair Accessible, Captioned, ASL Available, Low-Sensory, Accessible Materials |
| `price_model` | Price Model | No (single-select) | Free, Paid, Donation-Based, Membership Included, Corporate Sponsored |
| `pace` | Pace | No (single-select) | Introductory, Standard Pace, Fast-Paced, Self-Directed |
| `content_intensity` | Content Intensity | No (single-select) | Light, Moderate, Deep Dive |
| `delivery_features` | Delivery Features | Yes (multi-select) | Recorded Replay, Materials Included, Certificate Included, Community Access, Q&A Included |
| `venue_type` | Venue Type | No (single-select) | Studio, Classroom, Co-Working Space, Kitchen, Outdoor Site, Home Visit, Makerspace, Retreat Center |
| `booking_context` | Booking Context | No (single-select) | Open Enrollment, Private Group, Corporate Team-Building, Birthday Event, School Program, Festival Activity |
| `seasonality` | Seasonality | No (single-select) | Year-Round, Seasonal, Holiday, Summer, Weekend-Friendly |

---

## Primary Form Tags

The following six tag groups are the primary set shown in the workshop create/edit form and the browse page filter sidebar. The remaining 10 groups are available in an expanded "More options" section.

**Primary (always visible):**
- `skill_level` — Skill Level
- `format` — Format
- `duration` — Duration
- `audience` — Audience
- `experience_style` — Experience Style
- `group_size` — Group Size

**Secondary (expandable):**
- `environment`, `goals_outcomes`, `accessibility`, `price_model`, `pace`, `content_intensity`, `delivery_features`, `venue_type`, `booking_context`, `seasonality`

---

## Machine-Ready JSON

The full taxonomy in JSON format, suitable for use as seeder source data.

### Category and Subcategory Tree

```json
[
  {
    "category": "Arts & Visuals",
    "subcategories": [
      { "name": "Photography", "specializations": ["Landscape", "Long Exposure", "Astrophotography", "Portrait", "Studio Lighting", "Street Photography", "Wildlife", "Documentary", "Mobile Photography", "Editing & Retouching"] },
      { "name": "Painting", "specializations": ["Acrylic", "Watercolor", "Oil", "Gouache", "Abstract Painting"] },
      { "name": "Drawing", "specializations": ["Sketching", "Figure Drawing", "Perspective", "Charcoal", "Ink Illustration"] },
      { "name": "Illustration", "specializations": ["Editorial Illustration", "Digital Illustration", "Character Design", "Concept Art", "Children's Illustration"] },
      { "name": "Printmaking", "specializations": ["Screen Printing", "Linocut", "Woodcut", "Etching", "Monotype"] },
      { "name": "Mixed Media", "specializations": ["Collage", "Journaling", "Assemblage", "Experimental Techniques", "Found Materials"] },
      { "name": "Sculpture", "specializations": ["Clay Sculpting", "Wire Sculpture", "Paper Sculpture", "Relief Sculpture", "Installation Art"] },
      { "name": "Craft Art", "specializations": ["Calligraphy", "Hand Lettering", "Papercraft", "Bookbinding", "Zentangle"] },
      { "name": "Digital Art", "specializations": ["Procreate", "Photoshop", "Tablet Drawing", "Generative Art", "AI-Assisted Art"] },
      { "name": "Comics & Manga", "specializations": ["Manga Drawing", "Storyboarding", "Sequential Art", "Character Development", "Comic Inking"] },
      { "name": "Ceramics & Pottery", "specializations": ["Wheel Throwing", "Handbuilding", "Glazing", "Surface Design", "Raku"] }
    ]
  },
  {
    "category": "Performing Arts",
    "subcategories": [
      { "name": "Dance", "specializations": ["Ballet", "Hip-Hop", "Contemporary", "Salsa", "Ballroom", "Tap", "African Dance", "Improvisation"] },
      { "name": "Music", "specializations": ["Songwriting", "Music Theory", "Piano", "Guitar", "Drums", "Voice", "Beatmaking", "Music Production"] },
      { "name": "Theater & Acting", "specializations": ["Improvisation", "Scene Study", "Character Work", "Audition Prep", "Monologues", "Playwriting", "Directing", "Musical Theater"] },
      { "name": "Performance Skills", "specializations": ["Public Speaking", "Stage Presence", "Voice Projection", "Movement for Performance", "Comedy", "Circus Arts"] }
    ]
  },
  {
    "category": "Writing & Storytelling",
    "subcategories": [
      { "name": "Creative Writing", "specializations": ["Fiction", "Poetry", "Short Stories", "Flash Fiction", "Literary Fiction"] },
      { "name": "Screenwriting", "specializations": ["Feature Film", "TV Writing", "Writing for Streaming", "Dialogue", "Story Structure"] },
      { "name": "Nonfiction Writing", "specializations": ["Essay Writing", "Memoir", "Journalism", "Personal Essay", "Research Writing"] },
      { "name": "Copywriting & Content", "specializations": ["Advertising Copy", "Social Media Writing", "SEO Writing", "Email Writing", "Brand Voice"] },
      { "name": "Publishing", "specializations": ["Editing", "Proofreading", "Book Design", "Self-Publishing", "Writing Workflow"] },
      { "name": "Storytelling", "specializations": ["Narrative Design", "Oral Storytelling", "Podcast Storytelling", "Personal Storytelling", "Story Arc"] },
      { "name": "Journaling", "specializations": ["Bullet Journaling", "Art Journaling", "Reflective Writing", "Prompt-Based Writing", "Memory Keeping"] }
    ]
  },
  {
    "category": "Digital & Tech",
    "subcategories": [
      { "name": "Programming", "specializations": ["Web Development", "Python", "JavaScript", "Mobile Apps", "APIs", "Data Structures", "Version Control", "Testing & Debugging"] },
      { "name": "Design", "specializations": ["UI Design", "UX Design", "Design Systems", "Figma", "Interaction Design"] },
      { "name": "Data & Analytics", "specializations": ["Data Visualization", "Excel", "SQL", "Business Intelligence", "Dashboard Design"] },
      { "name": "No-Code & Automation", "specializations": ["Webflow", "Zapier", "Airtable", "Notion", "Workflow Automation"] },
      { "name": "AI & Machine Learning", "specializations": ["Prompt Engineering", "AI Tools for Work", "Machine Learning Basics", "Generative AI", "AI for Creativity"] },
      { "name": "Cybersecurity", "specializations": ["Privacy Basics", "Secure Coding", "Threat Awareness", "Digital Safety", "Identity Protection"] },
      { "name": "Photography Tech", "specializations": ["Camera Settings", "Lighting Tech", "Video Production", "Color Management", "File Workflow"] }
    ]
  },
  {
    "category": "Business & Entrepreneurship",
    "subcategories": [
      { "name": "Startup", "specializations": ["Idea Validation", "Lean Startup", "Pitch Decks", "Go-to-Market", "Fundraising"] },
      { "name": "Strategy", "specializations": ["Business Models", "Strategic Planning", "Competitive Analysis", "Operations", "KPIs"] },
      { "name": "Marketing", "specializations": ["Brand Strategy", "Content Marketing", "SEO", "Paid Ads", "Email Marketing"] },
      { "name": "Sales", "specializations": ["Prospecting", "Discovery Calls", "Closing", "Negotiation", "CRM"] },
      { "name": "Finance", "specializations": ["Budgeting", "Pricing", "Bookkeeping", "Cash Flow", "Financial Planning"] },
      { "name": "Leadership", "specializations": ["Team Management", "Decision-Making", "Communication", "Executive Presence", "Change Management"] },
      { "name": "Productivity", "specializations": ["Time Management", "Focus", "Task Systems", "Goal Setting", "Personal Organization"] },
      { "name": "Career Development", "specializations": ["Interviewing", "Resume Writing", "Networking", "Personal Branding", "Portfolio Building"] }
    ]
  },
  {
    "category": "Wellness & Mindfulness",
    "subcategories": [
      { "name": "Meditation", "specializations": ["Breath Awareness", "Mindfulness", "Loving-Kindness", "Stress Reduction", "Focus Training"] },
      { "name": "Yoga", "specializations": ["Hatha", "Vinyasa", "Yin", "Restorative", "Prenatal Yoga"] },
      { "name": "Breathwork", "specializations": ["Box Breathing", "Somatic Breathwork", "Relaxation", "Energy Regulation", "Nervous System Support"] },
      { "name": "Stress Management", "specializations": ["Burnout Prevention", "Resilience", "Sleep Support", "Anxiety Management", "Work-Life Balance"] },
      { "name": "Self-Care", "specializations": ["Journaling", "Boundaries", "Rest Practices", "Reflection", "Habit Building"] },
      { "name": "Spirituality", "specializations": ["Intuition", "Ritual Design", "Energy Practices", "Conscious Living", "Nature Connection"] }
    ]
  },
  {
    "category": "Outdoor & Adventure",
    "subcategories": [
      { "name": "Hiking", "specializations": ["Day Hikes", "Trail Skills", "Navigation", "Leave No Trace", "Backpacking Basics"] },
      { "name": "Camping", "specializations": ["Tent Camping", "Car Camping", "Outdoor Cooking", "Campcraft", "Wilderness Safety"] },
      { "name": "Water Activities", "specializations": ["Kayaking", "Canoeing", "Paddleboarding", "Snorkeling", "Sailing Basics"] },
      { "name": "Cycling", "specializations": ["Road Cycling", "Mountain Biking", "Bike Maintenance", "Gravel Riding", "Urban Cycling"] },
      { "name": "Survival Skills", "specializations": ["Fire Building", "Shelter Building", "First Aid", "Wilderness Preparedness", "Outdoor Navigation"] },
      { "name": "Nature & Wildlife", "specializations": ["Birdwatching", "Foraging", "Nature Journaling", "Wildlife Tracking", "Ecology"] }
    ]
  },
  {
    "category": "Culinary",
    "subcategories": [
      { "name": "Cooking Basics", "specializations": ["Knife Skills", "Kitchen Fundamentals", "Meal Prep", "Pantry Planning", "Recipe Reading"] },
      { "name": "Baking", "specializations": ["Bread Making", "Cakes", "Pastry", "Cookies", "Sourdough"] },
      { "name": "Regional Cuisine", "specializations": ["Italian", "Mexican", "Japanese", "Thai", "Mediterranean"] },
      { "name": "Healthy Cooking", "specializations": ["Plant-Based", "Gluten-Free", "Low-Sugar", "Whole Foods", "Family Meals"] },
      { "name": "Entertaining", "specializations": ["Dinner Parties", "Plating", "Wine Pairing", "Charcuterie", "Small-Plate Menus"] },
      { "name": "Fermentation & Preservation", "specializations": ["Pickling", "Canning", "Kimchi", "Kombucha", "Fermented Foods"] },
      { "name": "Specialty Diets", "specializations": ["Vegan", "Vegetarian", "Keto", "Allergy-Friendly", "High-Protein"] }
    ]
  },
  {
    "category": "Crafts & Maker",
    "subcategories": [
      { "name": "Sewing & Textiles", "specializations": ["Sewing Basics", "Pattern Making", "Alterations", "Embroidery", "Quilting"] },
      { "name": "Woodworking", "specializations": ["Joinery", "Furniture Making", "Finishing", "Hand Tools", "Power Tools"] },
      { "name": "Jewelry Making", "specializations": ["Beading", "Wire Wrapping", "Metalwork", "Resin Jewelry", "Soldering"] },
      { "name": "Leathercraft", "specializations": ["Tooling", "Bag Making", "Wallet Making", "Stitching", "Dyeing"] },
      { "name": "DIY Home Projects", "specializations": ["Home Repair", "Upcycling", "Furniture Restoration", "Decor Projects", "Tool Safety"] },
      { "name": "Paper Crafts", "specializations": ["Origami", "Scrapbooking", "Card Making", "Papercutting", "Book Arts"] },
      { "name": "3D Making", "specializations": ["3D Printing", "Laser Cutting", "Model Making", "Prototyping", "Maker Tools"] }
    ]
  },
  {
    "category": "Education & Teaching",
    "subcategories": [
      { "name": "Teaching Practice", "specializations": ["Lesson Planning", "Classroom Facilitation", "Active Learning", "Assessment Design", "Feedback Skills"] },
      { "name": "Curriculum Design", "specializations": ["Learning Outcomes", "Course Design", "Syllabus Design", "Instructional Design", "Learning Materials"] },
      { "name": "Tutoring & Coaching", "specializations": ["One-on-One Instruction", "Study Skills", "Homework Support", "Test Prep", "Academic Coaching"] },
      { "name": "Adult Learning", "specializations": ["Andragogy", "Facilitation", "Workshop Design", "Peer Learning", "Reflective Practice"] },
      { "name": "Language Teaching", "specializations": ["ESL", "Pronunciation", "Grammar", "Conversation Practice", "Vocabulary Building"] },
      { "name": "Special Education", "specializations": ["Accessibility", "Differentiation", "Inclusive Teaching", "Learning Support", "Universal Design"] }
    ]
  },
  {
    "category": "Lifestyle & Hobbies",
    "subcategories": [
      { "name": "Gardening", "specializations": ["Flower Gardening", "Vegetable Gardening", "Indoor Plants", "Herb Gardens", "Composting"] },
      { "name": "Home & Living", "specializations": ["Home Organization", "Interior Styling", "Decluttering", "Minimalism", "Seasonal Decorating"] },
      { "name": "Pets & Animals", "specializations": ["Pet Training", "Animal Care", "Dog Enrichment", "Cat Care", "Pet Photography"] },
      { "name": "Games & Recreation", "specializations": ["Board Games", "Card Games", "Puzzle Solving", "Game Design", "Trivia"] },
      { "name": "Travel", "specializations": ["Travel Planning", "Packing", "Cultural Etiquette", "Solo Travel", "City Exploration"] },
      { "name": "Photography as Hobby", "specializations": ["Street Photography", "Nature Photography", "Smartphone Photography", "Photo Walks", "Editing Basics"] }
    ]
  },
  {
    "category": "Personal Development",
    "subcategories": [
      { "name": "Goal Setting", "specializations": ["Vision Setting", "Planning", "Accountability", "Habit Tracking", "Execution"] },
      { "name": "Confidence", "specializations": ["Self-Esteem", "Public Presence", "Assertiveness", "Social Confidence", "Self-Advocacy"] },
      { "name": "Communication", "specializations": ["Active Listening", "Conflict Resolution", "Boundaries", "Difficult Conversations", "Emotional Intelligence"] },
      { "name": "Creativity", "specializations": ["Brainstorming", "Idea Generation", "Creative Habits", "Creative Blocks", "Inspiration Practices"] },
      { "name": "Mindset", "specializations": ["Growth Mindset", "Resilience", "Motivation", "Self-Discipline", "Reframing"] },
      { "name": "Life Skills", "specializations": ["Adulting", "Decision-Making", "Money Habits", "Routine Building", "Self-Management"] }
    ]
  },
  {
    "category": "Fitness & Movement",
    "subcategories": [
      { "name": "Strength Training", "specializations": ["Bodyweight Training", "Weightlifting", "Kettlebells", "Mobility Prep", "Form & Technique"] },
      { "name": "Cardio", "specializations": ["Running", "HIIT", "Dance Fitness", "Low-Impact Cardio", "Endurance Training"] },
      { "name": "Flexibility & Mobility", "specializations": ["Stretching", "Mobility Work", "Recovery", "Warmups", "Cooldowns"] },
      { "name": "Mind-Body Movement", "specializations": ["Pilates", "Tai Chi", "Qigong", "Somatic Movement", "Functional Movement"] },
      { "name": "Sports Skills", "specializations": ["Tennis", "Soccer", "Climbing", "Swimming", "Martial Arts"] }
    ]
  },
  {
    "category": "Community & Culture",
    "subcategories": [
      { "name": "Community Building", "specializations": ["Facilitation", "Group Dynamics", "Networking", "Civic Engagement", "Volunteer Training"] },
      { "name": "Culture & Heritage", "specializations": ["Local History", "Folk Arts", "Traditions", "Cultural Storytelling", "Heritage Skills"] },
      { "name": "Social Impact", "specializations": ["Advocacy", "Nonprofit Skills", "Community Organizing", "Fundraising", "Impact Measurement"] }
    ]
  }
]
```

### Cross-Cutting Tags JSON

```json
{
  "skill_level": ["Beginner", "Beginner-Friendly", "Intermediate", "Advanced", "All Levels"],
  "format": ["In-Person", "Virtual", "Hybrid", "Self-Paced", "Live Instruction"],
  "duration": ["Single Session", "Multi-Day", "Weekend Workshop", "Intensive", "Retreat", "Ongoing Series"],
  "audience": ["Adults", "Kids", "Teens", "Seniors", "Professionals", "Creatives", "Hobbyists"],
  "group_size": ["1-on-1", "Small Group", "Large Group"],
  "experience_style": ["Hands-On", "Lecture-Based", "Guided Practice", "Critique-Based", "Collaborative", "Immersive"],
  "environment": ["Indoor", "Outdoor", "Studio-Based", "On-Location", "Travel-Based"],
  "goals_outcomes": ["Portfolio Building", "Skill Development", "Certification", "Creative Exploration", "Business Growth"],
  "accessibility": ["Wheelchair Accessible", "Captioned", "ASL Available", "Low-Sensory", "Accessible Materials"],
  "price_model": ["Free", "Paid", "Donation-Based", "Membership Included", "Corporate Sponsored"],
  "pace": ["Introductory", "Standard Pace", "Fast-Paced", "Self-Directed"],
  "content_intensity": ["Light", "Moderate", "Deep Dive"],
  "delivery_features": ["Recorded Replay", "Materials Included", "Certificate Included", "Community Access", "Q&A Included"],
  "venue_type": ["Studio", "Classroom", "Co-Working Space", "Kitchen", "Outdoor Site", "Home Visit", "Makerspace", "Retreat Center"],
  "booking_context": ["Open Enrollment", "Private Group", "Corporate Team-Building", "Birthday Event", "School Program", "Festival Activity"],
  "seasonality": ["Year-Round", "Seasonal", "Holiday", "Summer", "Weekend-Friendly"]
}
```

---

## Extensibility Notes

- One primary category per workshop. Secondary paths supported in `workshop_taxonomy` via `is_primary = false`.
- Tags absorb emerging formats and niche themes without requiring taxonomy changes.
- Promote tags to specializations when browse volume for a tag is consistently high within a subcategory.
- Digital Art, Design, and Photography Tech are intentionally separate subcategories at launch — consolidate only if inventory justifies it.
- The `Education & Teaching` and `Community & Culture` categories are intentionally kept separate from `Business & Entrepreneurship` and `Personal Development` for marketplace clarity, even though they could be merged for simpler v1 tooling.
