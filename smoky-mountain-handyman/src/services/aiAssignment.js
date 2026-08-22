const anthropic = require('../config/anthropic');
const supabase = require('../config/supabase');

/**
 * Use Claude AI to determine the best contractor for a job.
 * Considers: skills match, availability, hourly rate, rating, workload.
 */
async function assignContractor(jobDescription, urgency) {
  // Fetch available contractors
  const { data: contractors, error } = await supabase
    .from('contractors')
    .select('*')
    .neq('availability_status', 'offline');

  if (error || !contractors || contractors.length === 0) {
    console.error('No contractors available:', error);
    return { contractor_id: null, reason: 'No contractors available' };
  }

  // Build contractor summaries for Claude
  const contractorList = contractors.map((c, i) => ({
    index: i,
    id: c.id,
    name: c.name,
    skills: c.skills,
    hourly_rate: c.hourly_rate,
    availability: c.availability_status,
    rating: c.rating,
    jobs_completed: c.jobs_completed,
  }));

  const prompt = `You are a dispatch AI for Smoky Mountain Handyman. Given a job and a list of contractors, pick the BEST contractor.

JOB:
- Description: "${jobDescription}"
- Urgency: ${urgency}

CONTRACTORS:
${JSON.stringify(contractorList, null, 2)}

RULES:
1. Skills must match the job type (e.g., plumbing issue → plumber)
2. For "emergency" urgency, prefer available contractors even if more expensive
3. For "low" urgency, prefer lower-cost contractors
4. Higher-rated contractors are preferred when skills are equal
5. If no contractor has exact skills, pick the closest match with "general" skills

Respond with ONLY valid JSON (no markdown, no backticks):
{
  "contractor_id": "the-uuid-here",
  "reason": "Brief explanation of why this contractor was chosen",
  "estimated_hours": 2.5,
  "required_skills": ["plumbing"]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text.trim();
    // Strip markdown backticks if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const assignment = JSON.parse(cleaned);

    // Validate the contractor_id exists
    const valid = contractors.find(c => c.id === assignment.contractor_id);
    if (!valid) {
      // Fallback: pick first available
      const fallback = contractors.find(c => c.availability_status === 'available') || contractors[0];
      return {
        contractor_id: fallback.id,
        reason: `AI suggested invalid contractor, assigned ${fallback.name} as fallback`,
        estimated_hours: 2,
        required_skills: [],
      };
    }

    return assignment;
  } catch (err) {
    console.error('Claude AI assignment error:', err);
    // Fallback: pick first available contractor
    const fallback = contractors.find(c => c.availability_status === 'available') || contractors[0];
    return {
      contractor_id: fallback.id,
      reason: `AI unavailable, assigned ${fallback.name} (first available)`,
      estimated_hours: 2,
      required_skills: [],
    };
  }
}

module.exports = { assignContractor };
