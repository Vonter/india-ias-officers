# india-ias-officers

Dataset of IAS (Indian Administrative Service) officer profiles. Sourced from the [SUPREMO IAS officer directory](https://supremo.dopt.gov.in/knowyourofficerIAs.aspx) maintained by the Department of Personnel & Training (DoPT).

View the raw dataset [here](https://hyparam.github.io/demos/hyparquet/?key=https%3A%2F%2Fraw.githubusercontent.com%2FVonter%2Findia-ias-officers%2Fmain%2Fdata%2Fpartial%2Fofficers.parquet?raw=1).

Explore the data on [https://india-ias-officers.pages.dev](https://india-ias-officers.pages.dev).

## Data

The headline dataset is one self-contained nested document per officer:

* [combined.jsonl](data/combined.jsonl?raw=1): One officer object per line, as JSON Lines.
* [combined.parquet](data/combined.parquet?raw=1): The identical structure as nested Parquet (list/struct columns).

The same data is also published as a set of normalised tables under [data/partial/](data/partial), all keyed by the officer's `identity_no`.

* [officers.parquet](data/partial/officers.parquet?raw=1) ([csv](data/partial/officers.csv.zip?raw=1)): One row per officer, including bio details and central-deputation summary.
* [education.parquet](data/partial/education.parquet?raw=1) ([csv](data/partial/education.csv.zip?raw=1)): Educational qualifications.
* [experience.parquet](data/partial/experience.parquet?raw=1) ([csv](data/partial/experience.csv.zip?raw=1)): Experience details (postings).
* [mid_career_training.parquet](data/partial/mid_career_training.parquet?raw=1) ([csv](data/partial/mid_career_training.csv.zip?raw=1)): Mid-career training details.
* [in_service_training.parquet](data/partial/in_service_training.parquet?raw=1) ([csv](data/partial/in_service_training.csv.zip?raw=1)): In-service training details.
* [domestic_training.parquet](data/partial/domestic_training.parquet?raw=1) ([csv](data/partial/domestic_training.csv.zip?raw=1)): Domestic training details.
* [foreign_training.parquet](data/partial/foreign_training.parquet?raw=1) ([csv](data/partial/foreign_training.csv.zip?raw=1)): Foreign training details.
* [awards_publications.parquet](data/partial/awards_publications.parquet?raw=1) ([csv](data/partial/awards_publications.csv.zip?raw=1)): Awards and publications.

For more details, refer to the [DATA.md](DATA.md).

## Scripts

- [fetch.py](fetch.py): Scrapes the raw biodata HTMLs from the SUPREMO IAS officer directory into `raw/`
- [parse.py](parse.py): Parses the raw HTMLs to generate the Parquet and compressed CSV datasets

## License

This india-ias-officers dataset is made available under the Open Database License: http://opendatacommons.org/licenses/odbl/1.0/.
Some individual contents of the database are under copyright by the Department of Personnel & Training (DoPT), Government of India.

You are free:

* **To share**: To copy, distribute and use the database.
* **To create**: To produce works from the database.
* **To adapt**: To modify, transform and build upon the database.

As long as you:

* **Attribute**: You must attribute any public use of the database, or works produced from the database, in the manner specified in the ODbL. For any use or redistribution of the database, or works produced from it, you must make clear to others the license of the database and keep intact any notices on the original database.
* **Share-Alike**: If you publicly use any adapted version of this database, or works produced from an adapted database, you must also offer that adapted database under the ODbL.
* **Keep open**: If you redistribute the database, or an adapted version of it, then you may use technological measures that restrict the work (such as DRM) as long as you also redistribute a version without such measures.

## Generating

Ensure that `python` and the required dependencies in `requirements.txt` are installed.

```
# Fetch the officer biodata pages
python fetch.py

# Parse the officer biodata pages
python parse.py
```

## Credits

- [DoPT SUPREMO](https://supremo.dopt.gov.in/knowyourofficerIAs.aspx)

## AI Declaration

Components of this repository, including code and documentation, were written with assistance from Claude AI.
