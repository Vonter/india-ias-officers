// Shapes mirror the published Parquet schema. Every source value is a string;
// empty strings stand in for missing data.

export interface Officer {
	identity_no: string;
	name: string;
	service: string;
	cadre: string;
	allotment_year: string;
	date_of_birth: string;
	gender: string;
	place_of_domicile: string;
	mother_tongue: string;
	languages_known: string;
	source_of_recruitment: string;
	retirement_reason: string;
	on_central_deputation: string;
	deputation_start_date: string;
	deputation_expiry_date: string;
	deputation_tenure_type: string;
	date_of_joining: string;
	/** Computed during data setup: in active service with a live posting. */
	serving: boolean;
}

export interface Education {
	qualification_university_institute: string;
	subject: string;
	division: string;
}

export interface Posting {
	designation_level: string;
	ministry_dept_office_location: string;
	organisation: string;
	experience_major_minor: string;
	period_from: string;
	period_to: string;
}

export interface MidCareerTraining {
	year: string;
	training_name: string;
	date_from: string;
	date_to: string;
}

export interface InServiceTraining {
	year: string;
	training_name: string;
	institute: string;
	city: string;
	duration_weeks: string;
}

export interface DomesticTraining {
	year: string;
	name: string;
	subject: string;
	duration: string;
}

export interface ForeignTraining {
	year: string;
	name: string;
	subject: string;
	duration: string;
	country: string;
}

export interface AwardPublication {
	type: string;
	area: string;
	year: string;
	award_name_book_title: string;
	awards_given_by_publisher: string;
	subject: string;
	level: string;
}

export interface NestedOfficer {
	identity_no: string;
	name: string;
	service: string;
	cadre: string;
	allotment_year: string;
	date_of_birth: string;
	gender: string;
	place_of_domicile: string;
	mother_tongue: string;
	source_of_recruitment: string;
	date_of_joining: string;
	retirement_reason: string;
	languages_known: string[];
	central_deputation: {
		on_deputation: string;
		start_date: string;
		expiry_date: string;
		tenure_type: string;
	};
	education: Education[];
	experience: Posting[];
	training: {
		mid_career: MidCareerTraining[];
		in_service: InServiceTraining[];
		domestic: DomesticTraining[];
		foreign: ForeignTraining[];
	};
	awards_publications: AwardPublication[];
}

export interface ExperienceRow extends Posting {
	identity_no: string;
	sno: string;
}

/** Flat education table consumed by the directory's education filter and facet. */
export interface EducationRow {
	identity_no: string;
	qualification_university_institute: string;
}

/** A single value within a facet (one department, cadre, language, …). */
export interface FacetValue {
	label: string;
	slug: string;
	totalOfficers: number;
	currentCount: number;
	totalPostings: number;
}
