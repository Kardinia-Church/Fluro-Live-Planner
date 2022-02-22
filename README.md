# Fluro Live Plan Viewer
This project is a site block for [Fluro](https://www.fluro.io/) which provides a live plan viewer for use during services.

## Service Director View
![1](/img/example1.png)
![1](/img/example2.png)

## Volunteer View
![1](/img/example3.png)

# Features
* Preview a plan
* Song information populated to the plan including BPM, key, and Youtube video
* Control of the plan showing current and next items
* Add headcount to an event
* Mobile view available

# Installation
This is a site block which will be inserted into a Fluro website.

1. Goto [Apps > Site Blocks](https://app.fluro.io/sites/components)
2. Create a new site block
3. Copy and paste script, html and css into the site block fields.
4. Go into the component fields tab
5. Add the following fields
![1](/img/fields1.png)
![2](/img/fields2.png)
![3](/img/fields3.png)
6. Add a page named "plan" with the url "/plan/:id" and place the site block you created earlier
![4](/img/page1.png)
7. Goto the home page and add the site block again.
8. In the block settings change the page to the page you created in step 6. This is where it will redirect to when a plan is selected. You can also restrict the plans to a realm if you wish using the filter list.
9. Save the site!!

# Usage
If configured above you can access the plan list by going to your site's home page. This will redirect to the /plan/<id> page when a plan is selected. One can also manually goto a plan if the id is known by simply putting it's id into the <id> part of the url.

# Permissions
This site block requires permissions to work. The permissions are as follows:
1. View plans (site level)
2. View events (site level)
3. Basic web permissions (site level)
4. Edit plan (user level)
5. Add/edit headcount (user level)

You may also want to restrict the site to login.

# Future Development
  The following features are aimed to be added in the future:
  * Better integration with the [Church Clocks](https://github.com/Kardinia-Church/Church-Clocks) project
  * Abbility to change the current countdown
  * Chat
  * Ping message (A popup alerting users to something) (Like a call)
  * Notes live notes on an item
  
# Liability
I do not take any responsibility for this project so use it at your own risk. There may be possibility of problems so do your own testing.
