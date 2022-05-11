# supportyourlocal.band

What would a local band need?

## Key Features

### MVP

OK, the "Minimal Work from Me" version is still too much work to get started. I think a static site is the best first step. (And maybe the best overall as well.) Just base it off of our current site.

* Mobile-first design
* Home page with sections
* EPK
* Gigs / Previous gigs
* Contact information

### Minimal Work from Me

Face it, if this takes a lot of my time I won't do it. I'm happy to add features and do basic tech support, but **all** of the administration needs to be done by the bands.

### Email

Managing an email list and sending out newsletters and updates is something that I have not found a source I like for yet. This is the key feature.

### Song List

This will not only be a source of information for their home page, but will fuel set list creation. Data should include song title, artist, link (or links) to audio, duration, and flags for featured and mothballed.

### External Links

This site is meant to be a central location. You can upgrade (or downgrade) your site to paid/self-hosted at any time without penalty or hassle. (If you wanted a custom domain, for instance.) Everything else can be linked to.

### Style Guide

It will make style guides easy and fun! Home pages and emails will use templates that will apply the styles automatically. This is the real killer feature.

### The Rest

Fan accounts. Like/follow bands. Write "reviews"

## Monitization

Custom domain, more storage space (for photos.)

Advertise for local venues and bands.

## API Style

Endure backup and parse test. (In case of catastrophic failure.)

Admin key in .env (for backups and troubleshooting)

## Features for next version

All https

Add facebook event link to gig

### Sub-Array Data

Make separate page for sub-arrays (like track listing) Adding URL media links should end up working the same way.

Song media should be an array that includes media type (Spotify, mp3, etc.) a URL, description, and credits.

Add 0 to infinite media - audio, video to songs and releases.

### Central Site

* Home Page
* Blog
* Form to sign up for beta

### Tests

Songs partially done. The rest, not at all

### Known Bugs

* Updates don't persist new form data after 400
* Deletion can cause invalid state

## Features for next next version

After creating a resource, should it redirect you to that resource?

### Image upload
* optimization
* resize: thumbnail, medium, large, and original

Custom fonts - Upload and make available in style guide.

Style guide page. Populate drop-down from guide colors.

I don't think *Site* is the proper resource name. It should probably be *Style* and be displayed as a proper style guide. Have up to 6 colors (or infinite?) and make the top 2 the web site ones. Should there be shades of color? Maybe.

Get local features working with member cities. "Check in" on mobile when at open mics, etc.

Email list

EPK

Password recovery using email.

More data validation

#### Setup Agreement:

On setup, read and agree to rules:

1. Do not libel or harrass other bands or their fandom.
2. Make your city locations accurate and non-spammy.

Also, setup need more work:
* When you hit the front-end site it is weird
