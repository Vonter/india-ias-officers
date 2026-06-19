# india-ias-officers

The source data is fetched from the [SUPREMO IAS officer directory](https://supremo.dopt.gov.in/knowyourofficerIAs.aspx) maintained by the Department of Personnel & Training (DoPT).

The data is split across one parent table (`officers`) and several child tables, joined on the officer's identity number — named `ID` in `officers` and `identity_no` in the child tables. The same data is additionally published as one nested document per officer in [combined.jsonl](data/combined.jsonl) and [combined.parquet](data/combined.parquet).

## officers

One row per officer: bio details and central-deputation summary.

| Variable | Type | Description |
|----------|------|-------------|
| ID | string | Unique identity number of the officer |
| Name | string | Name of the officer |
| Cadre | string | State cadre the officer is allotted to |
| Allotment_Year | string | Year of allotment to the service |
| Date_of_Birth | string | Date of birth |
| Date_of_Joining | string | Date of joining the service |
| Source_of_Recruitment | string | Source of recruitment (e.g. Direct Recruitment) |
| Gender | string | Gender |
| Place_of_Domicile | string | Place of domicile |
| Mother_Tongue | string | Mother tongue |
| Languages_Known | string | Languages known (space-separated) |
| Retired | string | Retirement flag: empty if unknown, 0 while serving, 1 once retired |
| Retirement_Reason | string | Reason for retirement, if retired |
| Service | string | Service the officer belongs to (e.g. IAS) |
| On_Central_Deputation | string | Whether presently on deputation to the Government of India |
| Deputation_Start_Date | string | Date of start of central deputation |
| Deputation_Expiry_Date | string | Expiry date of the tenure of central deputation |
| Deputation_Tenure_Type | string | Tenure type of the central deputation |

## education

Educational qualifications (Section III of the biodata).

| Variable | Type | Description |
|----------|------|-------------|
| identity_no | string | Identity number of the officer |
| sno | string | Serial number of the qualification |
| qualification_university_institute | string | Qualification, university or institute |
| subject | string | Subject of study |
| division | string | Division/class obtained |

## experience

Experience details, i.e. postings (Section IV of the biodata).

| Variable | Type | Description |
|----------|------|-------------|
| identity_no | string | Identity number of the officer |
| sno | string | Serial number of the posting |
| designation_level | string | Designation and level |
| ministry_dept_office_location | string | Ministry, department, office and location |
| organisation | string | Organisation |
| experience_major_minor | string | Major/minor field of experience |
| period_from | string | Start date of the posting |
| period_to | string | End date of the posting |

## mid_career_training

Mid-career training details (Section V of the biodata).

| Variable | Type | Description |
|----------|------|-------------|
| identity_no | string | Identity number of the officer |
| sno | string | Serial number of the training |
| year | string | Year of training |
| training_name | string | Name of the training |
| date_from | string | Start date of the training |
| date_to | string | End date of the training |

## in_service_training

In-service training details (Section VI of the biodata).

| Variable | Type | Description |
|----------|------|-------------|
| identity_no | string | Identity number of the officer |
| sno | string | Serial number of the training |
| year | string | Year of training |
| training_name | string | Name of the training |
| institute | string | Institute conducting the training |
| city | string | City where the training was held |
| duration_weeks | string | Duration of the training in weeks |

## domestic_training

Domestic training details (Section VII of the biodata).

| Variable | Type | Description |
|----------|------|-------------|
| identity_no | string | Identity number of the officer |
| sno | string | Serial number of the training |
| year | string | Year of training |
| name | string | Name of the training |
| subject | string | Subject of the training |
| duration | string | Duration of the training |

## foreign_training

Foreign training details (Section VIII of the biodata).

| Variable | Type | Description |
|----------|------|-------------|
| identity_no | string | Identity number of the officer |
| sno | string | Serial number of the training |
| year | string | Year of training |
| name | string | Name of the training |
| subject | string | Subject of the training |
| duration | string | Duration of the training |
| country | string | Country where the training was held |

## awards_publications

Awards and publications (Section IX of the biodata).

| Variable | Type | Description |
|----------|------|-------------|
| identity_no | string | Identity number of the officer |
| sno | string | Serial number of the award/publication |
| type | string | Type (award or publication) |
| area | string | Area of the award/publication |
| year | string | Year of the award/publication |
| award_name_book_title | string | Name of the award or title of the book |
| awards_given_by_publisher | string | Awarding body or publisher |
| subject | string | Subject of the award/publication |
| level | string | Level of the award/publication |
