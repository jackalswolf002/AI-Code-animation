#import <Foundation/Foundation.h>
#import <JavaScriptCore/JavaScriptCore.h>
#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <CoreText/CoreText.h>

static NSColor *parseCSSColor(NSString *str, CGFloat globalAlpha) {
    if (!str || ![str isKindOfClass:[NSString class]]) {
        return [NSColor colorWithDeviceRed:0 green:0 blue:0 alpha:globalAlpha];
    }
    NSString *s = [str stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    if ([s hasPrefix:@"#"]) {
        NSString *hex = [s substringFromIndex:1];
        if (hex.length == 6) {
            unsigned int rgb = 0;
            [[NSScanner scannerWithString:hex] scanHexInt:&rgb];
            CGFloat r = ((rgb >> 16) & 0xFF) / 255.0;
            CGFloat g = ((rgb >> 8) & 0xFF) / 255.0;
            CGFloat b = (rgb & 0xFF) / 255.0;
            return [NSColor colorWithDeviceRed:r green:g blue:b alpha:globalAlpha];
        }
    } else if ([s hasPrefix:@"rgba("] || [s hasPrefix:@"rgb("]) {
        BOOL isRgba = [s hasPrefix:@"rgba("];
        NSString *inner = [s substringWithRange:NSMakeRange(isRgba ? 5 : 4, s.length - (isRgba ? 6 : 5))];
        NSArray *parts = [inner componentsSeparatedByString:@","];
        if (parts.count >= 3) {
            CGFloat r = [parts[0] doubleValue] / 255.0;
            CGFloat g = [parts[1] doubleValue] / 255.0;
            CGFloat b = [parts[2] doubleValue] / 255.0;
            CGFloat a = (parts.count >= 4) ? [parts[3] doubleValue] : 1.0;
            return [NSColor colorWithDeviceRed:r green:g blue:b alpha:a * globalAlpha];
        }
    }
    return [NSColor colorWithDeviceRed:1 green:1 blue:1 alpha:globalAlpha];
}

static NSFont *resolveCanvasFont(NSString *fontStr) {
    if (!fontStr) fontStr = @"20px PingFang SC";
    BOOL isBold = [fontStr containsString:@"bold"] || [fontStr containsString:@"900"] || [fontStr containsString:@"800"];
    CGFloat fontSize = 20.0;
    NSRegularExpression *re = [NSRegularExpression regularExpressionWithPattern:@"([0-9]+(\\.[0-9]+)?)px" options:0 error:nil];
    NSTextCheckingResult *match = [re firstMatchInString:fontStr options:0 range:NSMakeRange(0, fontStr.length)];
    if (match) {
        fontSize = [[fontStr substringWithRange:[match rangeAtIndex:1]] doubleValue];
    }
    NSString *fontName = isBold ? @"PingFangSC-Semibold" : @"PingFangSC-Regular";
    if ([fontStr containsString:@"Songti"] || [fontStr containsString:@"serif"]) {
        fontName = isBold ? @"STSongti-SC-Bold" : @"STSongti-SC-Regular";
    }
    NSFont *font = [NSFont fontWithName:fontName size:fontSize];
    if (!font) font = [NSFont boldSystemFontOfSize:fontSize];
    return font;
}

@interface CanvasGradient : NSObject
@property (nonatomic, assign) BOOL isRadial;
@property (nonatomic, assign) CGFloat x0, y0, r0, x1, y1, r1;
@property (nonatomic, strong) NSMutableArray<NSNumber *> *offsets;
@property (nonatomic, strong) NSMutableArray<NSString *> *colors;
@end

@implementation CanvasGradient
- (instancetype)init {
    if (self = [super init]) {
        _offsets = [NSMutableArray array];
        _colors = [NSMutableArray array];
    }
    return self;
}
@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        if (argc < 3) {
            fprintf(stderr, "Usage: %s <src_dir> <output_mp4> [snapshot_time]\n", argv[0]);
            return 1;
        }
        NSString *srcDir = [NSString stringWithUTF8String:argv[1]];
        NSString *outPath = [NSString stringWithUTF8String:argv[2]];
        double singleTime = (argc >= 4) ? atof(argv[3]) : -1.0;

        int W = 1920;
        int H = 1080;
        int FPS = 30;
        double DURATION = 56.0;

        CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
        uint8_t *pixelData = (uint8_t *)calloc(W * H * 4, 1);
        CGContextRef cg = CGBitmapContextCreate(
            pixelData, W, H, 8, W * 4, colorSpace,
            kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big
        );

        CGContextTranslateCTM(cg, 0, H);
        CGContextScaleCTM(cg, 1.0, -1.0);

        JSContext *js = [[JSContext alloc] init];
        js.exceptionHandler = ^(JSContext *context, JSValue *exception) {
            fprintf(stderr, "JS Exception: %s\n", [[exception toString] UTF8String]);
        };

        __block CGMutablePathRef currentPath = CGPathCreateMutable();
        __block NSMutableArray *stateStack = [NSMutableArray array];

        JSValue *ctxObj = [JSValue valueWithNewObjectInContext:js];
        ctxObj[@"fillStyle"] = @"#000000";
        ctxObj[@"strokeStyle"] = @"#000000";
        ctxObj[@"lineWidth"] = @(1.0);
        ctxObj[@"lineCap"] = @"butt";
        ctxObj[@"lineJoin"] = @"miter";
        ctxObj[@"font"] = @"20px PingFang SC";
        ctxObj[@"textAlign"] = @"left";
        ctxObj[@"textBaseline"] = @"alphabetic";
        ctxObj[@"globalAlpha"] = @(1.0);
        ctxObj[@"globalCompositeOperation"] = @"source-over";

        __weak JSValue *wCtx = ctxObj;

        void (^applyCompositeOp)(NSString *) = ^(NSString *op) {
            if ([op isEqualToString:@"lighter"] || [op isEqualToString:@"screen"]) {
                CGContextSetBlendMode(cg, kCGBlendModeScreen);
            } else {
                CGContextSetBlendMode(cg, kCGBlendModeNormal);
            }
        };

        ctxObj[@"save"] = ^{
            JSValue *cObj = wCtx;
            CGContextSaveGState(cg);
            [stateStack addObject:@([cObj[@"globalAlpha"] toDouble])];
            [stateStack addObject:cObj[@"fillStyle"] ?: @"#000000"];
            [stateStack addObject:cObj[@"strokeStyle"] ?: @"#000000"];
            [stateStack addObject:cObj[@"lineWidth"] ?: @(1.0)];
            [stateStack addObject:cObj[@"font"] ?: @"20px PingFang SC"];
            [stateStack addObject:cObj[@"textAlign"] ?: @"left"];
            [stateStack addObject:cObj[@"textBaseline"] ?: @"alphabetic"];
            [stateStack addObject:cObj[@"globalCompositeOperation"] ?: @"source-over"];
        };

        ctxObj[@"restore"] = ^{
            JSValue *cObj = wCtx;
            CGContextRestoreGState(cg);
            if (stateStack.count >= 8) {
                cObj[@"globalCompositeOperation"] = [stateStack lastObject]; [stateStack removeLastObject];
                cObj[@"textBaseline"] = [stateStack lastObject]; [stateStack removeLastObject];
                cObj[@"textAlign"] = [stateStack lastObject]; [stateStack removeLastObject];
                cObj[@"font"] = [stateStack lastObject]; [stateStack removeLastObject];
                cObj[@"lineWidth"] = [stateStack lastObject]; [stateStack removeLastObject];
                cObj[@"strokeStyle"] = [stateStack lastObject]; [stateStack removeLastObject];
                cObj[@"fillStyle"] = [stateStack lastObject]; [stateStack removeLastObject];
                cObj[@"globalAlpha"] = [stateStack lastObject]; [stateStack removeLastObject];
                applyCompositeOp([cObj[@"globalCompositeOperation"] toString]);
            }
        };

        ctxObj[@"translate"] = ^(double x, double y) {
            CGContextTranslateCTM(cg, x, y);
        };
        ctxObj[@"scale"] = ^(double sx, double sy) {
            CGContextScaleCTM(cg, sx, sy);
        };
        ctxObj[@"rotate"] = ^(double angle) {
            CGContextRotateCTM(cg, angle);
        };
        ctxObj[@"beginPath"] = ^{
            CGPathRelease(currentPath);
            currentPath = CGPathCreateMutable();
        };
        ctxObj[@"closePath"] = ^{
            CGPathCloseSubpath(currentPath);
        };
        ctxObj[@"moveTo"] = ^(double x, double y) {
            CGPathMoveToPoint(currentPath, NULL, x, y);
        };
        ctxObj[@"lineTo"] = ^(double x, double y) {
            CGPathAddLineToPoint(currentPath, NULL, x, y);
        };
        ctxObj[@"quadraticCurveTo"] = ^(double cpx, double cpy, double x, double y) {
            CGPathAddQuadCurveToPoint(currentPath, NULL, cpx, cpy, x, y);
        };
        ctxObj[@"bezierCurveTo"] = ^(double cp1x, double cp1y, double cp2x, double cp2y, double x, double y) {
            CGPathAddCurveToPoint(currentPath, NULL, cp1x, cp1y, cp2x, cp2y, x, y);
        };
        ctxObj[@"arc"] = ^(double x, double y, double r, double startAngle, double endAngle) {
            if (r > 0) {
                CGPathAddArc(currentPath, NULL, x, y, r, startAngle, endAngle, false);
            }
        };
        ctxObj[@"setLineDash"] = ^(JSValue *arr) {
            if ([arr isArray]) {
                NSArray *nsArr = [arr toArray];
                if (nsArr.count == 0) {
                    CGContextSetLineDash(cg, 0, NULL, 0);
                } else {
                    CGFloat lengths[16];
                    size_t count = MIN(nsArr.count, 16);
                    for (size_t i = 0; i < count; i++) lengths[i] = [nsArr[i] doubleValue];
                    CGContextSetLineDash(cg, 0, lengths, count);
                }
            }
        };

        ctxObj[@"createLinearGradient"] = ^JSValue *(double x0, double y0, double x1, double y1) {
            CanvasGradient *g = [[CanvasGradient alloc] init];
            g.isRadial = NO;
            g.x0 = x0; g.y0 = y0; g.x1 = x1; g.y1 = y1;
            JSValue *gVal = [JSValue valueWithNewObjectInContext:[JSContext currentContext]];
            gVal[@"__grad"] = g;
            gVal[@"addColorStop"] = ^(double offset, NSString *color) {
                [g.offsets addObject:@(offset)];
                [g.colors addObject:color ?: @"#000000"];
            };
            return gVal;
        };

        ctxObj[@"createRadialGradient"] = ^JSValue *(double x0, double y0, double r0, double x1, double y1, double r1) {
            CanvasGradient *g = [[CanvasGradient alloc] init];
            g.isRadial = YES;
            g.x0 = x0; g.y0 = y0; g.r0 = r0; g.x1 = x1; g.y1 = y1; g.r1 = r1;
            JSValue *gVal = [JSValue valueWithNewObjectInContext:[JSContext currentContext]];
            gVal[@"__grad"] = g;
            gVal[@"addColorStop"] = ^(double offset, NSString *color) {
                [g.offsets addObject:@(offset)];
                [g.colors addObject:color ?: @"#000000"];
            };
            return gVal;
        };

        void (^fillPathWithStyle)(CGPathRef) = ^(CGPathRef path) {
            JSValue *cObj = wCtx;
            applyCompositeOp([cObj[@"globalCompositeOperation"] toString]);
            CGFloat ga = [cObj[@"globalAlpha"] toDouble];
            JSValue *fs = cObj[@"fillStyle"];
            if ([fs isObject] && fs[@"__grad"] && ![fs[@"__grad"] isUndefined]) {
                CanvasGradient *g = [fs[@"__grad"] toObjectOfClass:[CanvasGradient class]];
                if (g && g.colors.count > 0) {
                    NSMutableArray *cgColors = [NSMutableArray array];
                    CGFloat locations[16];
                    size_t count = MIN(g.colors.count, 16);
                    for (size_t i = 0; i < count; i++) {
                        NSColor *c = parseCSSColor(g.colors[i], ga);
                        [cgColors addObject:(__bridge id)c.CGColor];
                        locations[i] = [g.offsets[i] doubleValue];
                    }
                    CGGradientRef grad = CGGradientCreateWithColors(colorSpace, (__bridge CFArrayRef)cgColors, locations);
                    CGContextSaveGState(cg);
                    CGContextAddPath(cg, path);
                    CGContextClip(cg);
                    if (g.isRadial) {
                        CGContextDrawRadialGradient(cg, grad, CGPointMake(g.x0, g.y0), g.r0, CGPointMake(g.x1, g.y1), g.r1, kCGGradientDrawsBeforeStartLocation | kCGGradientDrawsAfterEndLocation);
                    } else {
                        CGContextDrawLinearGradient(cg, grad, CGPointMake(g.x0, g.y0), CGPointMake(g.x1, g.y1), kCGGradientDrawsBeforeStartLocation | kCGGradientDrawsAfterEndLocation);
                    }
                    CGContextRestoreGState(cg);
                    CGGradientRelease(grad);
                    return;
                }
            }
            NSColor *c = parseCSSColor([fs toString], ga);
            CGContextSetFillColorWithColor(cg, c.CGColor);
            CGContextAddPath(cg, path);
            CGContextFillPath(cg);
        };

        ctxObj[@"fill"] = ^{
            fillPathWithStyle(currentPath);
        };

        ctxObj[@"stroke"] = ^{
            JSValue *cObj = wCtx;
            applyCompositeOp([cObj[@"globalCompositeOperation"] toString]);
            CGFloat ga = [cObj[@"globalAlpha"] toDouble];
            NSColor *c = parseCSSColor([cObj[@"strokeStyle"] toString], ga);
            CGContextSetStrokeColorWithColor(cg, c.CGColor);
            CGContextSetLineWidth(cg, [cObj[@"lineWidth"] toDouble]);
            NSString *cap = [cObj[@"lineCap"] toString];
            if ([cap isEqualToString:@"round"]) CGContextSetLineCap(cg, kCGLineCapRound);
            else CGContextSetLineCap(cg, kCGLineCapButt);
            NSString *join = [cObj[@"lineJoin"] toString];
            if ([join isEqualToString:@"round"]) CGContextSetLineJoin(cg, kCGLineJoinRound);
            else CGContextSetLineJoin(cg, kCGLineJoinMiter);
            CGContextAddPath(cg, currentPath);
            CGContextStrokePath(cg);
        };

        ctxObj[@"fillRect"] = ^(double x, double y, double w, double h) {
            CGMutablePathRef rectPath = CGPathCreateMutable();
            CGPathAddRect(rectPath, NULL, CGRectMake(x, y, w, h));
            fillPathWithStyle(rectPath);
            CGPathRelease(rectPath);
        };

        ctxObj[@"strokeRect"] = ^(double x, double y, double w, double h) {
            JSValue *cObj = wCtx;
            applyCompositeOp([cObj[@"globalCompositeOperation"] toString]);
            CGFloat ga = [cObj[@"globalAlpha"] toDouble];
            NSColor *c = parseCSSColor([cObj[@"strokeStyle"] toString], ga);
            CGContextSetStrokeColorWithColor(cg, c.CGColor);
            CGContextSetLineWidth(cg, [cObj[@"lineWidth"] toDouble]);
            CGContextStrokeRect(cg, CGRectMake(x, y, w, h));
        };

        ctxObj[@"measureText"] = ^JSValue *(NSString *text) {
            JSValue *cObj = wCtx;
            JSValue *res = [JSValue valueWithNewObjectInContext:[JSContext currentContext]];
            if (!text || text.length == 0) {
                res[@"width"] = @(0.0);
                return res;
            }
            NSFont *font = resolveCanvasFont([cObj[@"font"] toString]);
            NSDictionary *attrs = @{ NSFontAttributeName: font };
            NSAttributedString *attrStr = [[NSAttributedString alloc] initWithString:text attributes:attrs];
            CTLineRef line = CTLineCreateWithAttributedString((__bridge CFAttributedStringRef)attrStr);
            double width = CTLineGetTypographicBounds(line, NULL, NULL, NULL);
            CFRelease(line);
            res[@"width"] = @(width);
            return res;
        };

        ctxObj[@"fillText"] = ^(NSString *text, double x, double y) {
            if (!text || text.length == 0) return;
            JSValue *cObj = wCtx;
            applyCompositeOp([cObj[@"globalCompositeOperation"] toString]);
            CGFloat ga = [cObj[@"globalAlpha"] toDouble];
            NSColor *c = parseCSSColor([cObj[@"fillStyle"] toString], ga);
            NSFont *font = resolveCanvasFont([cObj[@"font"] toString]);

            NSDictionary *attrs = @{
                NSFontAttributeName: font,
                NSForegroundColorAttributeName: c
            };
            NSAttributedString *attrStr = [[NSAttributedString alloc] initWithString:text attributes:attrs];
            CTLineRef line = CTLineCreateWithAttributedString((__bridge CFAttributedStringRef)attrStr);
            CGFloat ascent = 0, descent = 0, leading = 0;
            double width = CTLineGetTypographicBounds(line, &ascent, &descent, &leading);

            NSString *align = [cObj[@"textAlign"] toString] ?: @"left";
            NSString *baseline = [cObj[@"textBaseline"] toString] ?: @"alphabetic";

            double drawX = x;
            if ([align isEqualToString:@"center"]) drawX -= width * 0.5;
            else if ([align isEqualToString:@"right"]) drawX -= width;

            double drawY = y;
            if ([baseline isEqualToString:@"middle"]) {
                drawY += (ascent - descent) * 0.42;
            }

            CGContextSaveGState(cg);
            CGContextTranslateCTM(cg, drawX, drawY);
            CGContextScaleCTM(cg, 1.0, -1.0);
            CGContextSetTextMatrix(cg, CGAffineTransformIdentity);
            CTLineDraw(line, cg);
            CGContextRestoreGState(cg);
            CFRelease(line);
        };

        NSString *timelineCode = [NSString stringWithContentsOfFile:[srcDir stringByAppendingPathComponent:@"timeline.js"] encoding:NSUTF8StringEncoding error:nil];
        NSString *renderCode = [NSString stringWithContentsOfFile:[srcDir stringByAppendingPathComponent:@"render.js"] encoding:NSUTF8StringEncoding error:nil];
        [js evaluateScript:timelineCode];
        [js evaluateScript:renderCode];

        JSValue *renderFn = js[@"renderFrame"];

        if (singleTime >= 0.0) {
            [stateStack removeAllObjects];
            ctxObj[@"globalAlpha"] = @(1.0);
            ctxObj[@"globalCompositeOperation"] = @"source-over";
            applyCompositeOp(@"source-over");
            [renderFn callWithArguments:@[ctxObj, @(singleTime), @(W), @(H)]];
            CGImageRef img = CGBitmapContextCreateImage(cg);
            NSBitmapImageRep *rep = [[NSBitmapImageRep alloc] initWithCGImage:img];
            NSData *pngData = [rep representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
            [pngData writeToFile:outPath atomically:YES];
            CGImageRelease(img);
            return 0;
        }

        NSString *audioMix = [srcDir stringByAppendingPathComponent:@"audio_mix.mp3"];
        NSString *cmd = [NSString stringWithFormat:
            @"/opt/homebrew/bin/ffmpeg -y -f rawvideo -pixel_format rgba -video_size %dx%d -framerate %d -i - -i \"%@\" -c:v libx264 -preset fast -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest \"%@\" 2>/dev/null",
            W, H, FPS, audioMix, outPath];

        FILE *pipe = popen([cmd UTF8String], "w");
        if (!pipe) {
            fprintf(stderr, "Failed to open ffmpeg pipe\n");
            return 1;
        }

        int totalFrames = (int)(DURATION * FPS);
        for (int f = 0; f < totalFrames; f++) {
            @autoreleasepool {
                double t = (double)f / (double)FPS;
                [stateStack removeAllObjects];
                ctxObj[@"globalAlpha"] = @(1.0);
                ctxObj[@"globalCompositeOperation"] = @"source-over";
                applyCompositeOp(@"source-over");
                [renderFn callWithArguments:@[ctxObj, @(t), @(W), @(H)]];
                fwrite(pixelData, 1, W * H * 4, pipe);
                if (f % 150 == 0) {
                    fprintf(stdout, "Rendered frame %d / %d (%.1fs)\n", f, totalFrames, t);
                    fflush(stdout);
                }
            }
        }

        pclose(pipe);
        fprintf(stdout, "Done! Video saved to %s\n", [outPath UTF8String]);
    }
    return 0;
}
