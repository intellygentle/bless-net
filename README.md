## This script helps you stay online at background for bless depin
## Note that you still need to keep your internet connection on to make the script work in background

# Step 1 
## Create an account if you haven't https://bless.network/dashboard?ref=4VKRZE
## Click on download extension and click on add extension at the chrome extension site
![Screenshot_20241220-170640_Mises](https://github.com/user-attachments/assets/5a984fa5-6af5-4067-add9-17aec7676d02)
![Screenshot_20241220-170724_Kiwi Browser](https://github.com/user-attachments/assets/f2869d11-cc4e-45d2-99f2-969add9e2d83)

## open the extension after adding it, then go to devtool in your browser

![Screenshot_20241220-171427_Kiwi Browser](https://github.com/user-attachments/assets/ff7da434-fad0-4fbf-a2e1-c5c1df63eb8d)

## Go back to the tab where the extension is opened and refresh it. once done, go back to the devtools tab and click on network

## click on the long hexadec string that starts with 12...

![Screenshot_20241220-172441_Kiwi Browser](https://github.com/user-attachments/assets/b42d5042-772f-48ee-a8b0-f4ca8f54fb29)

 
## at the other side of it, you will see headers, preview, response etc
## click on HEADERS-- check everything under it, you will find your full node ID that starts with 12...
## scroll down under headers you will see your bearer token. it is the part tagged 3 in the screenshot above
## click on preview-- it is the part circled in the screenshot above-- you will find your hardwareiD somewhere there
## peg the nodeID and the hardwareID together like this 12Dw....xyz:435635

## now open your vscode connected to Ubuntu or termux connected to Ubuntu 


