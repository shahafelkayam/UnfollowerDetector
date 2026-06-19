from PIL import Image
import sys

def remove_dark_background(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()
    
    new_data = []
    for item in data:
        # Get RGB values
        r, g, b, a = item
        
        # Calculate luminance
        luminance = 0.299*r + 0.587*g + 0.114*b
        
        # If it's a very dark pixel, make it transparent
        # We'll use a soft threshold to make it smooth
        if luminance < 30:
            # Map luminance 0-30 to alpha 0-255
            alpha = int((luminance / 30.0) * 255)
            new_data.append((r, g, b, alpha))
        else:
            new_data.append((r, g, b, 255))
            
    img.putdata(new_data)
    img.save(output_path, "PNG")
    print(f"Saved transparent image to {output_path}")

if __name__ == "__main__":
    if len(sys.argv) > 2:
        remove_dark_background(sys.argv[1], sys.argv[2])
    else:
        print("Usage: python make_transparent.py <input> <output>")
