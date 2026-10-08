// Guesses whether an ORCID account belongs to faculty, a student, etc., from
// the role titles on its current University of South Alabama affiliations.
// Rules are checked in order; the first match wins.

export const ROLES = ['faculty', 'student', 'staff', 'postdoc', 'unknown'] as const;
export type Role = (typeof ROLES)[number];

export interface Account {
	orcid: string;
	/** Account creation date, YYYY-MM-DD */
	created: string;
	role: Role;
	/** `title` when a role title decided it, `inferred` when weaker signals did */
	basis: 'title' | 'inferred';
	/** Role titles of current USA employments, for auditing */
	title: string;
}

/** Fix known misclassifications here: orcid → role */
const OVERRIDES: Record<string, Role> = {};

const ORG = /\bsouth alabama\b/i;
const POSTDOC = /post-? ?doc/i;
// Checked before FACULTY so that "Resident Physician" is a trainee, not faculty
const STUDENT =
	/student(?! employment)|candidate|\bresident\b|trainee|fellow|\bpgy-?\d|\bG[RT]A\b|graduate (research|teaching|assistant)/i;
// USA librarians hold faculty status, as do most USA Health physicians
const FACULTY =
	/prof+es+or|lecturer|instructor|faculty|dean|chair|librarian|clinical (assistant|associate)|physician(?! assistant)|surgeon|pathologist|hospitalist|\bchief\b/i;
const DOCTORATE = /\b(ph\.? ?d|m\.? ?d|d\.? ?n\.? ?p|ed\.? ?d|d\.? ?o|pharm\.? ?d|d\.? ?p\.? ?t|psy\.? ?d|doctor|doctorate)\b/i;

type Summary = {
	'role-title'?: string | null;
	'end-date'?: unknown;
	organization: { name: string };
};

function summaries(section: any, key: string): Summary[] {
	return (section?.['affiliation-group'] ?? []).flatMap((g: any) =>
		g.summaries.map((s: any) => s[key])
	);
}

export function classify(orcid: string, record: any): Account {
	const created = new Date(record.history['submission-date'].value).toISOString().slice(0, 10);
	const activities = record['activities-summary'];
	const employments = summaries(activities.employments, 'employment-summary');
	const educations = summaries(activities.educations, 'education-summary');
	const isCurrentUSA = (s: Summary) => ORG.test(s.organization.name) && !s['end-date'];

	const currentJobs = employments.filter(isCurrentUSA);
	const title = currentJobs.map((s) => s['role-title']?.trim() ?? '').filter(Boolean).join(' / ');
	const enrolled = educations.some(isCurrentUSA);
	const account = (role: Role, basis: Account['basis']): Account => ({
		orcid,
		created,
		role: OVERRIDES[orcid] ?? role,
		basis,
		title
	});

	if (POSTDOC.test(title)) return account('postdoc', 'title');
	if (STUDENT.test(title) || (enrolled && !currentJobs.length)) return account('student', 'title');
	if (FACULTY.test(title)) return account('faculty', 'title');
	if (title) return account('staff', 'title');

	// No role title: fall back to weaker signals
	const works: number = activities.works?.group?.length ?? 0;
	const hasDoctorate = educations.some((s) => s['end-date'] && DOCTORATE.test(s['role-title'] ?? ''));
	const hasGraduateDegree =
		hasDoctorate ||
		educations.some((s) => s['end-date'] && /master|\bm\.? ?[sa]\b|\bmsn\b|\bmba\b/i.test(s['role-title'] ?? ''));
	// iDs starting 0009- have been issued since about 2022
	const newId = orcid.startsWith('0009-');

	if (works === 0 && newId && !hasGraduateDegree) return account('student', 'inferred');
	if (works >= 5 || hasDoctorate || !newId) return account('faculty', 'inferred');
	return account('unknown', 'inferred');
}
