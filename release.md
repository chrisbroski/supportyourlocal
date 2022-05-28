# Release Notes

## 1.3.0 (2022-05-28)

### Login Improvements

If using the login form in the left nav on a page, it will redirect to the same page after successful login. If a user is logged in and navigates to the login page it will now automatically redirect to the home page.

### Photo Management

Photos will now create a thumbnail on upload to be used in photo lists and available for use elsewhere. For large files (over 2,000 px max width or height) a "web" version of max 1,200 px will be created that should be used instead of the original by default.

Compressed PNG images with a color palette and JPG with level 70.

Added size in kB of photos in the side list.

### Media Array

Songs and releases now have an unlimited number of audio, video, and article URLs.

### Accessibility

Added a skip nav link to the side bar.

## 1.2.3 - Released 2022-04-30

### Facebook event link for gigs

## 1.2.2 - Released 2022-04-30

### Upcoming Releases

You can now set the releases date for songs and releases in the future and they will be hidden from public until that date.

Releases can have a "promotion start" start that will cause it to show partially starting on that date before the full release date.

## 1.2.1 - Released 2022-04-25

### Version Information

You are looking at this feature right now!

### Bug fixes

Removed port number from meta data if :80.

Added size information to photo thumnails.

## 1.2.0 - Released 2022-04-25

The major new features are:

### Photo Upload

The clunky and feature-poor first version of photo upload is now live! I've started max storage at 100 MB, but that might be stingy. I'd like to dial-in an amount that won't be a hardhip for typical bands, but still small enough that my hosting costs are sustainable. Maybe 200 MB? We'll keep an eye on it. In the future,  I'd think a $20 1-time fee to upgrade to 1 GB might be the right way to help bands with greater photo needs and generate a little cash.

### Facebook Sharing Meta-data Support

The service `/api/meta` was created to provide meta-data in the `<head>` of a front-end web site including title, description, CSS includes (with versioning for optimal caching) and Facebook Open Graph tags. (You can test your Facebook sharing here https://developers.facebook.com/tools/debug/ ) The site description uses the "Description (Short Bio)" band information. The image preview uses the "Thumnail Photo" that you select in site data.

### Payment Integration

We only are supporting Venmo so far, but if you scroll to the bottom of the Band Information page, you can add your Venmo username for integration with a front-end tip jar feature.

### Back End Styling for Unauthorized Users

I completed a first pass to style navigation and pages for non-authorized users. I'd like it to be a reasonable alternative to a fancy front-end for people with screen readers (the visually imparied) or folks who just want a simpler and faster experience without all the gewgaws.

### Miscellaneous

I spent time making sure that initial password creation for new users and password changes are strightforward and include automatic re-login in with the updated credentials.

I also fixed bugs and cleaned up a lot of unnecessary code. As much as I am proud of myself for doing it, I get it's not exciting to normal people.
