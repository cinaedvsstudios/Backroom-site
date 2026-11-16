# **Project Backroom: Master Specification**

## **0\. Repository Metadata**

* Local Repository Path: `C:/Users/Chris/OneDrive/Documents/CINAEDVS/Backroom-site`  
* GitHub Repository URL: `https://github.com/cinaedvsstudios/Backroom-site`  
* Public Brand Name: `Backroom`  
* Repository Licence Position: No open-source licence by default. The repository is public for deployment only. Code, design, venue data, written content, images, and brand assets remain all rights reserved unless a separate licence is explicitly added later.

## **1\. Product Purpose and Scope**

Backroom is a mobile-first gay nightlife, fetish, darkroom, and travel venue directory. The primary audience is gay male travelers and locals who want to quickly find where to go, what is open, what is on tonight, and which venues match specific features such as darkroom, cruise-focused space, men-only access, dancefloor, smoking area, cocktails, dress code, playroom, or other venue-specific characteristics.

The site is not intended to be a general queer lifestyle blog or social network at launch. It is a practical directory and sharing tool. The core use cases are:

* A traveler arrives in a city and wants to know where to go.  
* A local wants to send a visitor a filtered list of relevant venues.  
* A user wants to tell friends, “I am going here, meet me there.”  
* A user wants to share one venue, several selected venues, or all matching venues in a city.  
* A user wants a quick mobile interface rather than searching Instagram, Google, Reddit, or old event sites.

Future social features, check-ins, chat, or attendance indicators may be considered later, but they are not required for the first launch.

## **2\. Architecture Philosophy**

The project follows a zero-backend, static-site model. GitHub Pages acts as the public hosting layer. The public traveler site reads static JSON files and assets directly from the repository. The local admin dashboard is used to edit data and export replacement JSON files, which are then uploaded or committed back into the GitHub repository.

The core architecture follows a “Zero Hard-Coding” principle where practical. The public `index.html` shell should not contain fixed site text, brand strings, legal text, colour values, or editable venue data. These values should be read from external configuration and data files such as `system_info.json`, `design_theme.json`, `listings.json`, and `events.json`.

This structure allows the public site to remain free to host, easy to update, and portable without needing a paid backend database.

## **3\. Technical Stack**

| Component | Technology / Strategy |
| ----- | ----- |
| Hosting | GitHub Pages public static site |
| Architecture | Single Page Application with Progressive Web App support |
| Public Data | JSON files stored in the repository |
| Venue Database | `listings.json` |
| Event Database | `events.json`, updated separately from venues |
| Admin Workflow | Local admin dashboard exports updated JSON files for manual upload or commit |
| Mapping | No embedded map at launch. Use native map/directions links only. Location access is requested only when the user chooses near-me, directions, or location mode, with manual location entry as a fallback. |
| Offline Mode | Service worker caches the app shell, listings data, events data, and essential assets |
| Translation | English first by default. Google Translate/widget available on the 18+ banner and inside the main controls so users can change language when needed. The site should also keep a structure ready for future localized string mapping. |
| Public Rating | “Rated by the gays” public rating placeholder at launch. Final functionality and storage method TBA. |
| Views | Third-party counter service required. The public site should pull the view count from the chosen third-party service and display it with an eye icon. Until the service is chosen, display a placeholder. |
| System Ratings | Custom JSON-driven venue ratings using fixed emoji/icon categories such as eggplants, water splash, age emojis, money bags, size emoji, peaches, party emoji, and views. |
| Deep Sharing | URL-based sharing for venues, filters, favorites view, and named shortlists |
| Link Previews | Optional generated static preview pages for Open Graph sharing |

## **4\. Public Site Files**

The production site should include at minimum:

* `index.html`  
* Main CSS file or CSS bundle  
* Main JavaScript file or JavaScript bundle  
* `system_info.json`  
* `design_theme.json`  
* `listings.json`  
* `events.json`  
* `history_log.json` or a public-safe history/audit file if needed  
* `manifest.webmanifest`  
* Service worker file  
* `404.html` fallback for direct links and SPA routing  
* `robots.txt`  
* `sitemap.xml` if static venue preview pages are generated  
* Logo and favicon assets  
* Placeholder venue image  
* Map marker image only if a future embedded map mode is implemented  
* Locally hosted venue images inside `/assets/venues/`

All asset paths should use relative URLs or a configurable base path so the site works correctly on GitHub Pages project URLs such as `/Backroom-site/` and also later under a custom domain.

## **5\. GitHub Pages Publishing Model**

Backroom will be published as a static GitHub Pages site. The simplest launch model is to publish from the `main` branch and root folder, with `index.html` in the repository root.

The live site reads public JSON files directly from the repository. Updates are made by editing data locally in the admin dashboard, exporting the updated JSON files, and uploading or committing those files back into the repository. No backend database or server-side admin system is required for launch.

GitHub Pages settings must be configured once after the repository is ready:

* Go to GitHub repository settings.  
* Open Pages settings.  
* Select deployment source.  
* Use `Deploy from a branch` if publishing directly from `main` and `/root`.  
* Confirm the generated live URL.  
* Test the deployed site in an incognito/private browser window.

If a custom domain is added later, DNS and GitHub Pages custom domain settings must be configured at that time. HTTPS should be enabled once DNS is working.

## **6\. Dynamic System and Configuration Files**

### **6.1 system\_info.json**

`system_info.json` stores public-facing system text and global site settings. It should include at minimum:

* Brand name  
* Short brand name  
* Copyright notice  
* Site description  
* Age gate title and text  
* Disclaimer text  
* About page text  
* Privacy summary text  
* Legal or Impressum text or link if required  
* Footer text  
* Contact or operator details if required  
* Version number or build date  
* Default city and country settings  
* Default language settings  
* Feature labels  
* Rating labels  
* Shortlist labels and empty-state messages  
* Favorites labels and empty-state messages  
* Import/export help text  
* Empty-state messages  
* Error messages

### **6.2 design\_theme.json**

`design_theme.json` stores the visual system and should include:

* Colour palette  
* Typography settings  
* Border radius values  
* Border widths  
* Spacing scale  
* Card styles  
* Window styles  
* Button styles  
* Active, inactive, and disabled states  
* Filter chip styles  
* Listing card styles  
* Detail panel styles  
* Map marker settings only if a future embedded map mode is implemented  
* PWA theme colour values

### **6.3 listings.json**

`listings.json` is the public venue database. It contains all venue entries used by the traveler frontend.

### **6.4 events.json**

`events.json` is the public events database. It is updated separately from `listings.json`. Link an event to an existing permanent venue by `Venue_ID` only when that relationship is meaningful. Festivals, citywide events, rotating parties and one-off events can be standalone records with their own `Event_Location`, city, country, date, description, price, dress code and source links. Do not create artificial venue entries merely to hold a single event.

### **6.5 history\_log.json**

`history_log.json` records admin-side changes. It may be public-safe if stored in the repository. It must not contain private notes, credentials, private contact details, private moderation notes, or anything that should not be visible publicly.

## **7\. Legal, Privacy, and Age Gate**

The site must include an 18+ entry gate before users access the main app during a new session. The age gate should be full screen, branded, and visually aligned with the dark design system. It must include age confirmation and the platform disclaimer.

The age gate should include a Google Translate control or translation widget so users can translate the entry/disclaimer text before continuing. The default launch language is English. Translation should also be available in the main app controls using a language/flag-style control, but translation should be a site-level function rather than a repeated control on every listing.

The disclaimer must be visible in the age gate, footer, and About section:

“All information provided on this platform is sourced directly from public domains, including but not limited to: official venue websites, Instagram, Facebook, Google Business profiles, and public directory listings. This page is not responsible for the accuracy of this data or for any information that may be considered defamatory. Users rely on this information at their own risk.”

The footer must dynamically render:

`Copyright © 2026 Backroom. All Rights Reserved.`

The site should include public About, Privacy, and Legal or Impressum content. Because the site is public-facing and operated from an EU/Germany context, Impressum/legal notice requirements should be checked before public promotion. For the launch draft, the legal/operator name can be listed as Backdoor unless a real company or formal operator name is added later.

The Legal/Impressum page should be written as a clear practical notice rather than marketing copy. It should include the site/operator name Backdoor, contact method, responsible person or business details if required, content responsibility statement, public-source data disclaimer, copyright notice, privacy/localStorage explanation, third-party service notes, and a statement that venue information may change and users should verify details with the venue before relying on them.

Privacy principles:

* No user accounts at launch.  
* No server-side storage of favorites, shortlists, or settings at launch.  
* Favorites, named shortlists, and user settings remain in the user’s browser localStorage.  
* Users may export favorites, shortlists, and settings to a local file and import them again if they want to move data between browsers or devices.  
* No tracking beyond any explicitly chosen anonymized views/statistics mechanism.  
* Views should exist in the data model and display with an eye icon placeholder. The final third-party counter service can be chosen later. The page should be structured so a counter code/snippet can be added to the viewing page without redesigning the rating layout.  
* Third-party widgets must be reviewed before use because they may introduce cookies, external requests, analytics, or privacy obligations.  
* Cookie consent should not be added unless the final implementation actually needs it.

## **8\. Data Schema and Spreadsheet Headers**

For spreadsheet exports and imports, the admin dashboard should recognize consistent column names. The public JSON can use structured nested data internally, but CSV exports must use stable headers so the data can be edited in Excel, Google Sheets, ChatGPT, Gemini, or similar tools.

### **8.1 Required Minimum Venue Fields**

| Field Name | Description |
| ----- | ----- |
| `Venue_ID` | Unique alphanumeric code, for example `BER-LAB-01`. This is the permanent matching key. |
| `Name` | Venue name. |
| `City` | City name. |
| `Country` | Country name. |
| `Category` | Venue type, for example Bar, Club, Sauna, Shop, Café, Party, Event. |
| `Status` | Display state. Valid launch states are `Live`, `Hold`, `Closed`, and `Flag`. |

### **8.2 Identity, Location, and Transport Fields**

| Field Name | Description |
| ----- | ----- |
| `Address` | Full street address or location text. |
| `Postcode` | Postcode if useful. |
| `Nearest_Station` | Nearest train/metro/tram/bus station for travelers, for example `Bourse`. |
| `Latitude` | Latitude for GPS sorting/map plotting. |
| `Longitude` | Longitude for GPS sorting/map plotting. |
| `Google_Maps_URL` | Optional direct Google Maps link. |
| `Apple_Maps_URL` | Optional direct Apple Maps link. |
| `Native_Map_Query` | Optional text query/address used to open the native phone map. |

### **8.3 Link and Sharing Fields**

| Field Name | Description |
| ----- | ----- |
| `Website_URL` | Official website. |
| `Instagram_URL` | Instagram profile or post. |
| `Facebook_URL` | Facebook page or event. |
| `Other_URL` | Any other useful public listing or ticket link. |
| `Source_URLs` | Public source links used to verify the listing. |
| `Share_URL` | Generated by the app, not usually edited manually. |

The public UI should provide a “Show on Map” or “Directions” action that opens the native phone map or the relevant map service. The site should not show an embedded map by default. When the user chooses directions or near-me/location behavior, the site should ask whether to use the device location or allow the user to enter a starting location manually. The public UI should also provide a “Share Link” action using the native iPhone/Android share sheet where supported.

### **8.4 Image and Description Fields**

| Field Name | Description |
| ----- | ----- |
| `Image_URL` | Full external image URL or local image filename. |
| `Description` | Fact-based public venue description covering atmosphere, history, crowd, and practical notes. |
| `Vibe_Tags` | Searchable comma-separated tags such as Bears, Pop, Outdoor, Techno, Leather, Cruise, Drag, Student, Mature, Local, Tourist. |
| `Last_Updated` | Date/time this listing was last changed by the admin import/editor workflow. |

`Last_Updated` should be set when a listing is created. When a later file upload or manual edit changes any field in that listing, `Last_Updated` should update to the date/time of that change. If an upload file is processed but a row does not actually change, `Last_Updated` should not change.

### **8.5 Opening Hours and Timing Fields**

Opening hours should be simple enough to manage in spreadsheets. The launch version should track the days the venue is open and the open/close times.

| Field Name | Description |
| ----- | ----- |
| `Opening_Days` | Days the venue is open, for example `Fri, Sat` or `Mon-Sun`. |
| `Opening_Open_Time` | Normal opening time. |
| `Opening_Close_Time` | Normal closing time. |
| `Opening_Notes` | Optional human-readable notes for unusual hours. |
| `Event_Date` | Optional date for temporary events or parties. Prefer `events.json` for recurring or detailed events. |
| `Event_Time` | Optional time for temporary events or parties. Prefer `events.json` for recurring or detailed events. |

### **8.6 Feature Fields**

Feature fields should use boolean values where possible:

| Field Name | Description |
| ----- | ----- |
| `Feature_Darkroom` | Has darkroom. |
| `Feature_Dresscode` | Has dress code. |
| `Feature_Men_Only` | Men-only venue or event. |
| `Feature_Dancefloor` | Has dancefloor. |
| `Feature_Smoking_Area` | Has smoking area, indoors or outdoors if known. |
| `Feature_Cocktails` | Serves cocktails. |
| `Feature_Cruise_Focused` | Cruise-focused venue or event. |
| `Feature_Sauna` | Sauna venue or sauna facilities. |
| `Feature_Playroom` | Has playroom/backroom/sex-positive space. |

### **8.7 Ratings and Display Metrics**

Ratings and display metrics should use a consistent public/system structure. System ratings are maintained by the admin in `listings.json`. Public ratings are separate and still need a final mechanism.

| Field Name | Display Label | Icon / Style | Description |
| ----- | ----- | ----- | ----- |
| `Public_Rating` | Rated by the gays | 🌈 placeholder at launch | Public/community rating placeholder. Final function and storage method can be chosen later. |
| `Rating_General` | General rating | Eggplants | Overall admin/system rating for the venue. |
| `Rating_Darkroom` | Darkroom | Water splash | Darkroom, playroom, or cruise-space quality rating. |
| `Rating_Age_Range` | Age range | 🧒🏼 🧑🏻 🧔🏻‍♂️ 👨🏻‍🦳 👴🏼 | Approximate crowd age range. Admin enters 1 to 5 in the sheet. The UI displays the cumulative emoji scale, so 1 shows 🧒🏼, 3 shows 🧒🏼🧑🏻🧔🏻‍♂️, and 5 shows all five emojis. |
| `Rating_Cost` | Cost | Money bags | Price/cost rating. |
| `Rating_Size` | Size | 🤏 👍 ✌️ 🖐️ 🤲 | Venue size/capacity rating. Admin enters 1 to 5 in the sheet. The UI displays the cumulative emoji scale, so 1 shows 🤏, 3 shows 🤏👍✌️, and 5 shows all five emojis. |
| `Rating_Location` | Location | Peaches | Location/convenience rating. |
| `Rating_Busyness` | How busy | Party emoji | How busy or lively the venue usually is. |
| `Views` | Views | Eye emoji or eye icon | View count placeholder at launch. Final third-party counter service TBA. |
| `Emoji_Override` | Override | Optional | Optional emoji/icon override if a listing needs a different display style. |

System ratings should use simple numeric sheet values. General, darkroom, cost, location, and busyness use 0 to 5\. Age range and size use 1 to 5 and display the cumulative emoji scale defined above.

### **8.8 Status Values**

Valid launch status values:

| Status | Public Behavior |
| ----- | ----- |
| `Live` | Listing displays normally. |
| `Hold` | Listing exists in the database but does not display publicly. |
| `Closed` | Listing displays publicly like a normal listing but with a clear closed status label. It should still appear in normal search results unless the user enables an “Only show open venues” filter. |
| `Flag` | Listing does not display publicly and is marked internally as needing attention, correction, review, or investigation. |

### **8.9 Admin-Only Fields**

| Field Name | Description |
| ----- | ----- |
| `Created_At` | Date/time listing was created. |
| `Flag_Reason` | Admin reason for `Flag` status. |

## **9\. Event Data Schema**

Events should be stored separately in `events.json` so they can be updated independently from permanent venue listings.

Use `Venue_ID` for events at an existing permanent venue. Leave it empty for citywide/multi-venue festivals and one-off or travelling events where a separate permanent listing would add no value. Store their temporary location or venue/address in `Event_Location` (and City/Country) directly on the event. Multi-day festival parents in `events.json` should also be grouped in `festivals.json`, with the actual start/end dates and linked `Event_IDs`; add the constituent sessions as individual events when announced.

Required minimum event fields:

| Field Name | Description |
| ----- | ----- |
| `Event_ID` | Unique event code. |
| `Event_Name` | Event or party name. |
| `Event_Date` | Date of the event. |
| `Event_Start_Time` | Start time. |
| `Event_End_Time` | End time if known. |
| `Status` | Live, Hold, Closed/Cancelled, or Flag. |

Recommended event fields:

| Field Name | Description |
| ----- | ----- |
| `Venue_ID` | Optional link to an existing permanent venue; blank for standalone events. |
| `Event_Location` | Event-specific location/address or multi-venue area, especially when `Venue_ID` is blank. |
| `City` / `Country` | City and country for location filters when no permanent venue is linked. |
| `Event_Description` | Public event description. |
| `Event_Image_URL` | Event-specific image if different from the venue. |
| `Ticket_URL` | Ticket or RSVP link. |
| `Price_Info` | Entry price or ticket notes. |
| `Dresscode_Info` | Event-specific dress code. |
| `Vibe_Tags` | Event-specific tags. |
| `Source_URLs` | Public source links used to verify event info. |
| `Last_Updated` | Date/time this event was last changed. |

The admin dashboard should provide the same three import modes for events as for venues: Update / Add Events, Replace All Events, and Remove Events.

On a venue detail screen, display events that have the matching `Venue_ID`. Standalone events with no linked venue must still appear in the calendar by their own location metadata, with full event details and without a misleading 'Venue not listed' label. Festival groupings use `festivals.json` and their date ranges.

## **10\. Traveler Frontend Logic**

### **10.1 Search and Filtering**

The public site should support:

* Free-text search across venue name, description, city, country, category, features, and vibe tags.  
* Dedicated filters for city, country, category, and features.  
* Filters for events/tonight where event data is available.  
* “Near Me” sorting only when the user specifically clicks a location, directions, or near-me action.  
* GPS sorting using device location only if permission is granted after the user chooses that action.  
* Manual fallback for country, city, postcode, station, address, or current starting point when GPS is not used.  
* Open/closed or tonight-relevant filtering if enough opening/event data exists.  
* An “Only show open venues” checkbox/filter that hides closed venues when enabled.  
* Clear reset controls to remove active filters.

The site should not load or display map/location behavior by default. Location logic should only activate when the user chooses “Show near me,” “Directions,” “Use my location,” or a similar explicit control. At that point, the user should be able to either allow device location or enter their own location manually.

### **10.2 Result Cards**

Search results should display as stacked mobile-first cards. Each card should show:

* Venue name  
* City and country  
* Category  
* Opening or status indicator  
* Key features  
* Vibe tags where useful  
* System ratings or relevant icons  
* Views placeholder/counter using an eye icon  
* Favorite/star control  
* Add to shortlist control  
* Share control  
* Tap/open detail action

Closed listings should remain visible in normal search results with a clear closed status label. They should only be hidden when the user enables an “Only show open venues” checkbox/filter.

### **10.3 Listing Detail View**

The listing detail screen should show:

* Venue name  
* Main image or placeholder  
* Category, city, country, address, and nearest station  
* Show on Map action  
* Website and social links  
* Opening days and open/close times  
* Description  
* Event information pulled from `events.json` and displayed after the venue description where relevant  
* Vibe tags  
* Feature indicators  
* System ratings  
* Rated by the gays public rating placeholder/function when available  
* Views placeholder/counter  
* Favorite/star control  
* Add to shortlist control  
* Share button  
* Previous/next navigation between search results  
* Close button  
* Last updated date/time

### **10.4 Favorites**

Favorites are private saved venues stored locally on the user’s device.

* Users can star a venue to save it locally.  
* Favorite `Venue_ID` values are stored in localStorage.  
* Starred venues should visibly show a star next to the listing in search results.  
* The site should include a Favorites view that shows all saved venues.  
* Users can export favorites as a local backup file.  
* Users can import a previously exported favorites file.  
* The export/import modal should explain that favorites are not tied to an account and must be backed up manually if users want to move them between devices.

### **10.5 Named Shortlists**

Shortlists are separate from favorites. A shortlist is like a named playlist for venues/clubs.

Users should be able to:

* Create a new shortlist with a custom name.  
* Add a venue to an existing shortlist.  
* Choose which shortlist to add a venue to when tapping “add to shortlist.”  
* Create a new shortlist from the add-to-shortlist flow.  
* Open a Shortlists menu showing all saved shortlists by name.  
* Delete a shortlist using an `X` control.  
* Edit a shortlist using an edit control.  
* In edit mode, see the club/venue names in that shortlist.  
* Remove venues from a shortlist using an `X` next to each venue.  
* Save the edited shortlist.  
* Generate a shareable URL for a shortlist.

Named shortlists should be stored in localStorage. Users should be able to export and import shortlists as part of the local settings/favorites backup workflow.

### **10.6 User Settings Export/Import**

User settings should be stored locally. This can include favorites, named shortlists, preferred language/translation setting, default city, and other user-controlled preferences.

Users should be able to export local settings to a file and import them again. This is optional for casual users, but useful for users who want to move data between devices or browsers.

## **11\. Deep Sharing, SEO, and Routing**

The site should support direct links to:

* Home/app shell  
* Venue detail views  
* City-filtered views  
* Category-filtered views  
* Feature-filtered views  
* Event views  
* Favorites view where practical on the local device  
* Named shortlist/share views

If generated venue preview pages are implemented, they should provide proper Open Graph metadata for social sharing and then redirect into the main app shell. Example: `/venue/BER-LAB-01.html` can provide metadata and then redirect to the app route for that venue.

The site should include a `404.html` fallback so direct links do not fail when opened directly from messaging apps or social platforms.

Production metadata should include:

* Page title  
* Site description  
* Favicon  
* App icons  
* Social preview image  
* Open Graph tags  
* Twitter or social card tags  
* Theme colour  
* Canonical URL if a custom domain is used

## **12\. Local Admin Dashboard**

The admin dashboard is a local or private editing tool used to manage the public static JSON files. It does not require a live backend.

The admin dashboard may live in the public repository as long as it contains no secrets, API keys, write tokens, private credentials, or private notes. A simple PIN gate may be used to hide or unlock the admin UI from casual visitors, but this must not be treated as real security if the file is public. The PIN can prevent accidental use, but it cannot protect secrets inside public code.

The dashboard should support:

* Loading existing `system_info.json`, `design_theme.json`, `listings.json`, and `events.json`.  
* Editing site text and configuration.  
* Editing design values.  
* Editing individual listings in a mobile-style preview.  
* Editing individual events.  
* Exporting updated JSON files.  
* Exporting venue and event data as spreadsheet-friendly CSV.  
* Importing spreadsheet-friendly CSV or JSON files.  
* Showing previews before applying changes.  
* Maintaining a public-safe `history_log.json` or local-only audit log.  
* Broken link checks for images and social or website URLs.  
* Unsaved-change detection using localStorage.  
* Updating `Last_Updated` only for rows that actually change.

### **12.1 Site Design Editor**

The design editor should allow the admin to modify values stored in `design_theme.json`, including colours, spacing, borders, button styles, card styles, and typography settings.

The editor may include element highlighting, where clicking an element in a preview opens the relevant editable design fields.

### **12.2 Single Listing Editor**

The admin dashboard should include a WYSIWYG-style mobile preview for editing one venue at a time. The editor should make it easy to update venue text, features, images, links, category, ratings, status, location data, vibe tags, and opening days/hours.

### **12.3 Single Event Editor**

The admin dashboard should include an event editor for `events.json`. It should make it easy to attach an event to a `Venue_ID`, enter event-specific dates/times/details, and export the updated events file.

## **13\. Spreadsheet Import and Data Management Workflow**

Backroom should support spreadsheet-compatible data management through the local admin dashboard. The master public venue database remains `listings.json`, and the events database remains `events.json`, but the admin tool should allow both datasets to be exported, edited externally, and re-imported using CSV or JSON.

The admin dashboard should support three import modes for venues and the same three import modes for events:

1. Update / Add  
2. Replace All  
3. Remove

### **13.1 Update / Add**

Update / Add is the safest and most common import mode. It should be used when the admin wants to change existing venue/event information or add new rows without replacing the entire database.

Each uploaded venue row must include `Venue_ID`. Each uploaded event row must include `Event_ID`. If the ID already exists, the admin tool updates only the fields included in the uploaded file. Columns that are not included must be left unchanged.

Blank cells must mean “no change.” A blank cell must not erase existing information. To intentionally clear an existing value, the upload should use `__CLEAR__`.

If the uploaded file contains an ID that does not already exist, the admin tool should treat it as a new row and validate that required fields are present.

Update / Add logic:

1. Upload a partial or complete CSV or JSON file.  
2. Match each row by `Venue_ID` or `Event_ID`.  
3. If the ID exists, update only included fields.  
4. If a cell is blank, leave the existing value unchanged.  
5. If a cell contains `__CLEAR__`, intentionally clear that field.  
6. If the ID does not exist, treat the row as new.  
7. Validate new rows before adding them.  
8. Show a preview of all changes before applying.  
9. Update `Last_Updated` only for rows that actually change.  
10. After approval, generate the updated JSON file for download.  
11. Record changes in `history_log.json` if the log is being used.

### **13.2 Replace All**

Replace All is a full database replacement mode. It should only be used when the uploaded file contains the complete current dataset.

This mode deletes the current data in memory and replaces it with the uploaded file. Because this is destructive, the admin dashboard must show a strong warning before applying the change.

The preview should show:

* Number of existing rows  
* Number of uploaded rows  
* Number of rows that will be removed  
* Number of rows that will be added  
* Number of overlapping IDs  
* Duplicate or invalid ID warnings

A partial upload must never silently replace the full database.

### **13.3 Remove**

Remove allows the admin to delete multiple venues or events using a file.

The removal file only needs to contain `Venue_ID` for venues or `Event_ID` for events. It may optionally include `Name`, `City`, `Country`, `Event_Name`, or `Reason` for human readability, but the ID is the only required field for matching.

The admin dashboard should match uploaded IDs against the current JSON file and show a deletion preview before applying.

Remove logic:

1. Upload a removal file containing IDs.  
2. Match each ID against the current data.  
3. Show a preview of all rows that will be removed.  
4. Show warnings for IDs that were not found.  
5. Require confirmation before applying.  
6. Remove the confirmed rows from the exported JSON.  
7. Record removed IDs in `history_log.json` if the log is being used.

The admin dashboard must never delete rows without showing a preview first.

### **13.4 Import Safety Rules**

All import modes must include validation before export. The admin tool should check for:

* Missing IDs  
* Duplicate IDs  
* Malformed columns  
* Invalid coordinates  
* Missing required fields for new rows  
* Unexpected file structure  
* Invalid URLs where practical  
* Unknown category/status values where practical  
* Events that reference a missing `Venue_ID`

Before applying any import, the admin dashboard should show a change preview. The preview should clearly show what will be changed, added, replaced, or removed. No import should silently modify the database without admin review.

After applying changes, the admin dashboard should generate the updated JSON file for download. The admin then uploads or commits the updated file back into the GitHub repository so the live GitHub Pages site receives the new data.

## **14\. Visual Design Direction**

Backroom should use a permanent dark-mode visual system with a mobile-first layout. The site should feel like a compact nightlife control panel rather than a generic venue directory. The visual language should combine dark sci-fi interface panels, gay nightlife signage, club listing cards, and practical traveler-focused mobile UI. It should look functional, bold, slightly sexy, and easy to understand quickly.

The core background colour is black `#000000`. The site should avoid white page backgrounds, pale panels, or generic light-mode layouts. All screens should feel dark by default, with colour used for function and emphasis.

### **14.1 Approved Colour Palette**

* Black background: `#000000`  
* Bright cyan blue: `#2CA8D4`  
* Dark cyan blue: `#00547C`  
* Near-black grey: `#0B0F19`  
* Deep navy grey: `#111725`  
* Dark panel grey: `#1F2535`  
* Standard panel grey: `#212530`  
* Mid panel grey: `#313748`  
* Soft grey: `#3E4252`  
* Muted label grey: `#53596B`  
* Light text grey: `#969CAE`  
* Bright red-orange: `#D55036`  
* Dark red: `#871300`

### **14.2 Colour Usage**

The greys should form the main structure of the site. Backgrounds, menus, cards, filter bars, listing containers, rating rows, and information blocks should be built from the grey palette.

Bright cyan blue `#2CA8D4` is the primary active colour. It should indicate selected filters, active tabs, current screens, active map/list modes, primary action buttons, focused panels, “near me,” “open now,” selected share options, active shortlist states, and navigation arrows.

Dark cyan blue `#00547C` may be used for pressed states, shadows, darker blue panels, secondary blue accents, or less prominent active elements.

Red-orange `#D55036` is used for links, warnings, closed/unavailable states, removed/excluded states, destructive actions, and strong “not selected” indicators where needed.

Dark red `#871300` should be used for deeper warning backgrounds, muted negative panels, or pressed red states.

Light grey `#969CAE` is the main readable body text colour.

Colour should not be overused. Most of the interface should remain black and grey. Blue and red should be used deliberately so the user understands what each colour means.

### **14.3 Typography**

The recommended display font is Antonio for headings, venue names, page titles, category labels, major buttons, and system-style interface text. Display text should usually be uppercase with controlled letter spacing.

The recommended body/UI font is Barlow or Barlow Condensed for descriptions, addresses, opening hours, disclaimers, metadata, and longer interface text.

Display text should be bold, condensed, and clear. Body text should prioritize readability on mobile. The display font should not be used for long paragraphs.

### **14.4 Window and Card Style**

The interface should use strong rectangular and segmented shapes, borrowing the feeling of dark sci-fi control panels without copying any specific existing franchise UI directly.

Main screens and detail views should sit inside dark grey windows or panels. Important windows should use a cyan outline. Rounded corners may be used for major windows, but inner elements should mostly remain blocky and segmented.

Listing detail windows should include:

* Large venue title near the top  
* Clear close button in the top-right  
* Main image area  
* Segmented information zones  
* Ratings, features, and actions grouped into compact modules  
* Previous and next navigation when browsing search results

Previous and next buttons should use the blue palette rather than green.

### **14.5 Search and Results Screen Layout**

The search/results screen acts as the main menu screen. It should include:

* Brand/header area  
* Search box  
* City, country, and category controls  
* Feature filters  
* Sort controls where needed  
* Stacked result cards  
* Optional near-me/map control that only activates when selected

On mobile, results should appear in one column. On desktop, the same system may widen, use two columns, or place filters/results beside a map or detail preview.

### **14.6 Listing Detail Screen Layout**

On mobile, the listing detail screen should stack vertically:

1. Venue title  
2. Image  
3. Key information  
4. Status/opening data  
5. Feature chips  
6. Ratings  
7. Action buttons and links  
8. Description  
9. Last updated/source notes where shown publicly

On desktop, the layout may split into columns, with image and description on one side and ratings, features, links, and actions on the other. It should still feel like the same interface.

## **15\. iPhone, Android, and PWA Support**

Backroom should be built as a mobile-first Progressive Web App with support for both iPhone and Android. The site must work properly in a normal mobile browser and should also be installable to the user’s home screen.

### **15.1 Core PWA Requirements**

* Include a valid `manifest.webmanifest`.  
* Use `display: standalone`.  
* Use `orientation: portrait` unless landscape support is intentionally added.  
* Include `192x192` and `512x512` PNG icons.  
* Include maskable icons for Android.  
* Use the logo mark only for app icons.  
* Include `apple-touch-icon` metadata.  
* Include iOS standalone metadata where useful.  
* Use safe-area CSS values such as `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.

### **15.2 Native Mobile Integration**

* Use `navigator.share()` for venue and shortlist sharing where supported.  
* Provide a copy-link fallback using `navigator.clipboard.writeText` where supported.  
* Provide a fallback copy method for older browsers.  
* Use `inputmode="numeric"` or suitable input types where numeric keyboards are helpful.  
* Use `autocomplete="off"` and `autocorrect="off"` for search fields where venue names may be incorrectly changed by mobile keyboards.  
* Use `-webkit-font-smoothing: antialiased` for crisp rendering on high-DPI screens.

### **15.3 Touch and Performance Optimization**

* Use touch-friendly controls.  
* Avoid hover-dependent interactions.  
* Use `touch-action: manipulation` on buttons and interactive cards.  
* Prevent map gestures from accidentally refreshing the page where practical.  
* Use lazy loading for images.  
* Set width/height placeholders for images to reduce layout shift.  
* Avoid fixed pixel-width containers.  
* Use responsive flexbox/grid layouts.

### **15.4 Offline and Service Worker**

The service worker should cache:

* App shell  
* Core CSS  
* Core JavaScript  
* Logo assets  
* Placeholder image  
* Manifest  
* Latest `listings.json`  
* Latest `events.json`  
* Essential configuration files

If the user is offline, the UI should show a “Browsing Offline” indicator and disable or warn about features requiring an internet connection.

External images and third-party resources should not be assumed to cache reliably. If an image fails, the site should use the placeholder image.

### **15.5 Testing Requirements**

The site should be tested on:

* Desktop Chrome  
* Desktop Firefox or Edge  
* iPhone Safari browser mode  
* iPhone home-screen standalone mode  
* Android Chrome browser mode  
* Android installed PWA mode  
* Samsung Internet if practical

## **16\. Asset Inventory**

Required public assets:

* `logo_brand.png`: Main branding  
* `logo_mark.png`: Logo mark for app icon and favicon use  
* `favicon.ico`: Browser tab icon  
* `apple-touch-icon.png`: iOS home-screen icon  
* `icon-192.png`: PWA icon  
* `icon-512.png`: PWA icon  
* `icon-maskable-192.png`: Android maskable icon  
* `icon-maskable-512.png`: Android maskable icon  
* `age_gate_bg.jpg`: 18+ screen background  
* `placeholder_venue.jpg`: Fallback for broken venue images  
* `map_pin.png`: Custom map marker only if a future embedded map mode is implemented  
* `/assets/venues/`: Locally hosted venue images  
* `social_preview.jpg`: Default social sharing image

## **17\. Implementation Phases**

The project should be generated in short implementation phases so the first live template can be tested quickly before entering large amounts of venue data.

### **Phase 1: Public Visual Prototype**

Build the first public-facing static prototype using sample JSON data. This phase should include the age gate, header/logo area, search/filter layout, result cards, listing detail window, rating rows, favorite/star button, shortlist button, share button, dark theme, typography, mobile-first layout, and sample venue/event display. This phase is mainly to test whether the design feels right on mobile and desktop.

### **Phase 2: Data Loading and Public Interaction**

Connect the prototype to real `system_info.json`, `design_theme.json`, `listings.json`, and `events.json` files. Implement search, filters, venue detail routing, event display inside venue pages, favorites view, named shortlists, localStorage persistence, share URLs, and the placeholder ratings/views system.

### **Phase 3: Admin Editing and Export Tools**

Build the local admin dashboard for loading existing JSON files, editing site settings, editing theme values, editing listings/events one at a time, exporting updated JSON files, and previewing the public card/detail layout. This phase should allow basic manual management without spreadsheet imports yet.

### **Phase 4: Spreadsheet Import/Export System**

Add CSV/JSON export and import for venues and events. Implement the three import modes: Update / Add, Replace All, and Remove. Include validation, change previews, duplicate ID warnings, missing field checks, `__CLEAR__` support, and `Last_Updated` logic.

### **Phase 5: PWA, Deployment, and Polish**

Add the manifest, icons, service worker, offline support, 404 fallback, GitHub Pages path handling, mobile safe-area handling, iPhone/Android testing, translation control placement, legal/about/privacy pages, and launch checklist fixes. This phase prepares the site for public use after the visual and data workflows are confirmed.

The first goal is to complete Phase 1 and upload it to GitHub Pages as quickly as possible so the visual direction can be tested before entering large amounts of real venue data.

## **18\. Launch Checklist**

Minimum viable launch should include:

* Working public app shell  
* Search and filters  
* Listing result cards  
* Listing detail view  
* Working JSON loading for `listings.json`  
* Working JSON loading for `events.json`  
* Age gate  
* Translation control on age gate and main controls  
* Disclaimer  
* About content  
* Privacy/legal content  
* Favicon and app icons  
* PWA manifest  
* Service worker  
* Placeholder image fallback  
* Small launch set of real or test listings  
* Small launch set of real or test events if event view launches immediately  
* Working favorites/star system  
* Working favorites view  
* Working named shortlists  
* Working shortlist/share URL  
* Working export/import for favorites, shortlists, and settings  
* Working admin export of `listings.json`  
* Working admin export of `events.json`  
* Working admin import modes for venues and events  
* Relative asset paths compatible with GitHub Pages project path

Before public promotion, test:

* Direct homepage load  
* Direct venue URL load  
* Direct event URL load if event routing launches immediately  
* Filtered URL load  
* Shortlist URL load  
* Broken image fallback  
* External links  
* Native map/directions link behavior  
* Near-me/location mode only when the user explicitly activates it  
* Favorites storage  
* Favorites export/import  
* Shortlist create/edit/delete/share  
* Settings export/import  
* Age gate behavior  
* Translation control behavior  
* Offline behavior  
* Mobile touch behavior  
* iPhone standalone mode  
* Android PWA mode  
* GitHub Pages deployment path

## **19\. Open Questions / Decisions Needed**

1. Which third-party view counter service should be used for the eye/view count? This can be worked out later. For launch, display an eye-icon placeholder and keep the viewing page structured so a counter snippet/code can be added later.  
2. How should “Rated by the gays” work after launch? This can be worked out later. For launch, display a placeholder using the rainbow emoji 🌈.  
3. Confirm whether the Legal or Impressum section should use Backdoor as the operator/site name for launch, or whether another exact operator/contact detail should be added.

SUPABASE Info

VITE\_SUPABASE\_URL=https://dcnxvxfnxdxogesoiuyy.supabase.co

VITE\_SUPABASE\_PUBLISHABLE\_KEY=sb\_publishable\_RM4cq6aOV7R0gVIiHFljAg\_K\_ByS7KH

