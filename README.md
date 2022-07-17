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

Add "powered by yourlocal.band" on site.

## API Style

Endure backup and parse test. (In case of catastrophic failure.)

## Features for next version

Fix bugs, HTTPS, data tools, password recovery (email)

### Tests

Songs partially done. The rest, not at all

### Known Bugs

* Updates don't persist new form data after 400
* Deletion can cause invalid state
* Small photos might create thumbnails larger than themselves.
* A "track" type Spotify link for release media breaks stuff on the front end.
* There seem to be 2 file extension functions: getExtension and main.extractFileType

## Features for next next version

All https

Admin key in .env (for data download and future executive feature)

Get local features working with member cities. "Check in" on mobile when at open mics, etc.

EPK

Password recovery using email.

More data validation

### Email List

Export instructions to email them your damn self. Add phone number too for mass spam texting.

## Onboarding:

On setup, read and agree to rules:

1. Do not libel or harrass other bands or their fandom.
2. Make your city locations accurate and non-spammy.

Also, setup needs more work:

* When you hit the front-end site it is weird
* Write new site script and test

## Central Site

### Blog articles

Funnel from QR code to persistent connection.

## Before Next 10

Onboarding process, https, password recovery via email, data tools (backup and restore data.json)
