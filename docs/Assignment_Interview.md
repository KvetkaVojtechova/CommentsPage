ASSIGNMENT 

A simple comments page.  

A possibility to register/login user (for the purposes of this test \-\> store only in  

localstorage/sessionstorage \- no DB needed)  

Only a logged in user can add comments, others (not logged in users / guests) can only see comments.  Comments create a tree structure, so that anybody can reply to any comment and the reply is 'attached'  as subtree to the comment it was replied to  

After button to 'Add Comment' is clicked a new worker is started that checks the comment for  inappropriate words defined in a JSON file  

If it contains any inappropriate word in any form, then the comment is blocked and a message appears  for the user, that he cannot use the word  

If it does not contain any inappropriate words the comment is added with timestamp to correct node  The inappropriate words JSON contains words \['Putin', 'Ukraine', 'Russia', 'War'\].

It is possible to use only pure HTML/CSS/JavaScript, no frameworks.  

The page should be optimized for screen resolution 1920x1080, aligned in the middle using 70% of width  (15% empty space on each side)  

The background color should be \#F5F5F5  

The font-family should be 'Lucida Handwriting'  

The font size should be 18px  

The 'Reply' button should have a backgroud color \#FFFFFF with text color \#00325A, hover effect the  opposite colors  

The 'Add Comment' button should have a background color \#FFFFFF with text color \#DE5050, hover  effect the opposite colors  

The message saying the user cannot use wording in the comment should have a text color \#FF8300 
