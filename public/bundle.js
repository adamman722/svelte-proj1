var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.49.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* UI\Header.svelte generated by Svelte v3.49.0 */

    const file = "UI\\Header.svelte";

    function create_fragment(ctx) {
    	let header;
    	let h1;

    	const block = {
    		c: function create() {
    			header = element("header");
    			h1 = element("h1");
    			h1.textContent = "Meet Us";
    			attr_dev(h1, "class", "svelte-2421t9");
    			add_location(h1, file, 4, 2, 35);
    			attr_dev(header, "class", "svelte-2421t9");
    			add_location(header, file, 3, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, h1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Header', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* Meetups\MeetupItem.svelte generated by Svelte v3.49.0 */

    const file$1 = "Meetups\\MeetupItem.svelte";

    function create_fragment$1(ctx) {
    	let article;
    	let header;
    	let h1;
    	let t0;
    	let t1;
    	let h20;
    	let t2;
    	let t3;
    	let h21;
    	let t4;
    	let t5;
    	let div0;
    	let img;
    	let img_src_value;
    	let t6;
    	let div1;
    	let p;
    	let t7;
    	let t8;
    	let footer;
    	let a;
    	let t9;
    	let a_href_value;
    	let t10;
    	let button0;
    	let t12;
    	let button1;

    	const block = {
    		c: function create() {
    			article = element("article");
    			header = element("header");
    			h1 = element("h1");
    			t0 = text(/*title*/ ctx[0]);
    			t1 = space();
    			h20 = element("h2");
    			t2 = text(/*subtitle*/ ctx[1]);
    			t3 = space();
    			h21 = element("h2");
    			t4 = text(/*address*/ ctx[4]);
    			t5 = space();
    			div0 = element("div");
    			img = element("img");
    			t6 = space();
    			div1 = element("div");
    			p = element("p");
    			t7 = text(/*description*/ ctx[3]);
    			t8 = space();
    			footer = element("footer");
    			a = element("a");
    			t9 = text("Contact");
    			t10 = space();
    			button0 = element("button");
    			button0.textContent = "Show Details";
    			t12 = space();
    			button1 = element("button");
    			button1.textContent = "Favorite";
    			attr_dev(h1, "class", "svelte-8tjse");
    			add_location(h1, file$1, 11, 4, 190);
    			attr_dev(h20, "class", "svelte-8tjse");
    			add_location(h20, file$1, 12, 4, 212);
    			attr_dev(h21, "class", "svelte-8tjse");
    			add_location(h21, file$1, 13, 4, 237);
    			attr_dev(header, "class", "svelte-8tjse");
    			add_location(header, file$1, 10, 2, 176);
    			if (!src_url_equal(img.src, img_src_value = /*imageUrl*/ ctx[2])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", /*title*/ ctx[0]);
    			attr_dev(img, "class", "svelte-8tjse");
    			add_location(img, file$1, 16, 4, 297);
    			attr_dev(div0, "class", "image svelte-8tjse");
    			add_location(div0, file$1, 15, 2, 272);
    			attr_dev(p, "class", "svelte-8tjse");
    			add_location(p, file$1, 19, 4, 372);
    			attr_dev(div1, "class", "content svelte-8tjse");
    			add_location(div1, file$1, 18, 2, 345);
    			attr_dev(a, "href", a_href_value = "mailto:" + /*email*/ ctx[5]);
    			add_location(a, file$1, 22, 4, 420);
    			add_location(button0, file$1, 23, 4, 462);
    			add_location(button1, file$1, 24, 4, 497);
    			attr_dev(footer, "class", "svelte-8tjse");
    			add_location(footer, file$1, 21, 2, 406);
    			attr_dev(article, "class", "svelte-8tjse");
    			add_location(article, file$1, 9, 0, 163);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, article, anchor);
    			append_dev(article, header);
    			append_dev(header, h1);
    			append_dev(h1, t0);
    			append_dev(header, t1);
    			append_dev(header, h20);
    			append_dev(h20, t2);
    			append_dev(header, t3);
    			append_dev(header, h21);
    			append_dev(h21, t4);
    			append_dev(article, t5);
    			append_dev(article, div0);
    			append_dev(div0, img);
    			append_dev(article, t6);
    			append_dev(article, div1);
    			append_dev(div1, p);
    			append_dev(p, t7);
    			append_dev(article, t8);
    			append_dev(article, footer);
    			append_dev(footer, a);
    			append_dev(a, t9);
    			append_dev(footer, t10);
    			append_dev(footer, button0);
    			append_dev(footer, t12);
    			append_dev(footer, button1);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*title*/ 1) set_data_dev(t0, /*title*/ ctx[0]);
    			if (dirty & /*subtitle*/ 2) set_data_dev(t2, /*subtitle*/ ctx[1]);
    			if (dirty & /*address*/ 16) set_data_dev(t4, /*address*/ ctx[4]);

    			if (dirty & /*imageUrl*/ 4 && !src_url_equal(img.src, img_src_value = /*imageUrl*/ ctx[2])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*title*/ 1) {
    				attr_dev(img, "alt", /*title*/ ctx[0]);
    			}

    			if (dirty & /*description*/ 8) set_data_dev(t7, /*description*/ ctx[3]);

    			if (dirty & /*email*/ 32 && a_href_value !== (a_href_value = "mailto:" + /*email*/ ctx[5])) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(article);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('MeetupItem', slots, []);
    	let { title } = $$props;
    	let { subtitle } = $$props;
    	let { imageUrl } = $$props;
    	let { description } = $$props;
    	let { address } = $$props;
    	let { email } = $$props;
    	const writable_props = ['title', 'subtitle', 'imageUrl', 'description', 'address', 'email'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<MeetupItem> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('title' in $$props) $$invalidate(0, title = $$props.title);
    		if ('subtitle' in $$props) $$invalidate(1, subtitle = $$props.subtitle);
    		if ('imageUrl' in $$props) $$invalidate(2, imageUrl = $$props.imageUrl);
    		if ('description' in $$props) $$invalidate(3, description = $$props.description);
    		if ('address' in $$props) $$invalidate(4, address = $$props.address);
    		if ('email' in $$props) $$invalidate(5, email = $$props.email);
    	};

    	$$self.$capture_state = () => ({
    		title,
    		subtitle,
    		imageUrl,
    		description,
    		address,
    		email
    	});

    	$$self.$inject_state = $$props => {
    		if ('title' in $$props) $$invalidate(0, title = $$props.title);
    		if ('subtitle' in $$props) $$invalidate(1, subtitle = $$props.subtitle);
    		if ('imageUrl' in $$props) $$invalidate(2, imageUrl = $$props.imageUrl);
    		if ('description' in $$props) $$invalidate(3, description = $$props.description);
    		if ('address' in $$props) $$invalidate(4, address = $$props.address);
    		if ('email' in $$props) $$invalidate(5, email = $$props.email);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [title, subtitle, imageUrl, description, address, email];
    }

    class MeetupItem extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			title: 0,
    			subtitle: 1,
    			imageUrl: 2,
    			description: 3,
    			address: 4,
    			email: 5
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MeetupItem",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*title*/ ctx[0] === undefined && !('title' in props)) {
    			console.warn("<MeetupItem> was created without expected prop 'title'");
    		}

    		if (/*subtitle*/ ctx[1] === undefined && !('subtitle' in props)) {
    			console.warn("<MeetupItem> was created without expected prop 'subtitle'");
    		}

    		if (/*imageUrl*/ ctx[2] === undefined && !('imageUrl' in props)) {
    			console.warn("<MeetupItem> was created without expected prop 'imageUrl'");
    		}

    		if (/*description*/ ctx[3] === undefined && !('description' in props)) {
    			console.warn("<MeetupItem> was created without expected prop 'description'");
    		}

    		if (/*address*/ ctx[4] === undefined && !('address' in props)) {
    			console.warn("<MeetupItem> was created without expected prop 'address'");
    		}

    		if (/*email*/ ctx[5] === undefined && !('email' in props)) {
    			console.warn("<MeetupItem> was created without expected prop 'email'");
    		}
    	}

    	get title() {
    		throw new Error("<MeetupItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<MeetupItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get subtitle() {
    		throw new Error("<MeetupItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set subtitle(value) {
    		throw new Error("<MeetupItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get imageUrl() {
    		throw new Error("<MeetupItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set imageUrl(value) {
    		throw new Error("<MeetupItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get description() {
    		throw new Error("<MeetupItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set description(value) {
    		throw new Error("<MeetupItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get address() {
    		throw new Error("<MeetupItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set address(value) {
    		throw new Error("<MeetupItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get email() {
    		throw new Error("<MeetupItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set email(value) {
    		throw new Error("<MeetupItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* Meetups\MeetupGrid.svelte generated by Svelte v3.49.0 */
    const file$2 = "Meetups\\MeetupGrid.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    // (8:2) {#each meetups as metting}
    function create_each_block(ctx) {
    	let meetupitem;
    	let current;

    	meetupitem = new MeetupItem({
    			props: {
    				title: /*metting*/ ctx[1].title,
    				subtitle: /*metting*/ ctx[1].subtitle,
    				imageUrl: /*metting*/ ctx[1].imageUrl,
    				description: /*metting*/ ctx[1].description,
    				address: /*metting*/ ctx[1].address,
    				email: /*metting*/ ctx[1].contactEmail
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(meetupitem.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(meetupitem, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const meetupitem_changes = {};
    			if (dirty & /*meetups*/ 1) meetupitem_changes.title = /*metting*/ ctx[1].title;
    			if (dirty & /*meetups*/ 1) meetupitem_changes.subtitle = /*metting*/ ctx[1].subtitle;
    			if (dirty & /*meetups*/ 1) meetupitem_changes.imageUrl = /*metting*/ ctx[1].imageUrl;
    			if (dirty & /*meetups*/ 1) meetupitem_changes.description = /*metting*/ ctx[1].description;
    			if (dirty & /*meetups*/ 1) meetupitem_changes.address = /*metting*/ ctx[1].address;
    			if (dirty & /*meetups*/ 1) meetupitem_changes.email = /*metting*/ ctx[1].contactEmail;
    			meetupitem.$set(meetupitem_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(meetupitem.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(meetupitem.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(meetupitem, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(8:2) {#each meetups as metting}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let section;
    	let current;
    	let each_value = /*meetups*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			section = element("section");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(section, "id", "meetups");
    			attr_dev(section, "class", "svelte-2c3snf");
    			add_location(section, file$2, 6, 0, 97);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, section, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(section, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*meetups*/ 1) {
    				each_value = /*meetups*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(section, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(section);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('MeetupGrid', slots, []);
    	let { meetups } = $$props;
    	const writable_props = ['meetups'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<MeetupGrid> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('meetups' in $$props) $$invalidate(0, meetups = $$props.meetups);
    	};

    	$$self.$capture_state = () => ({ MeetupItem, meetups });

    	$$self.$inject_state = $$props => {
    		if ('meetups' in $$props) $$invalidate(0, meetups = $$props.meetups);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [meetups];
    }

    class MeetupGrid extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { meetups: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MeetupGrid",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*meetups*/ ctx[0] === undefined && !('meetups' in props)) {
    			console.warn("<MeetupGrid> was created without expected prop 'meetups'");
    		}
    	}

    	get meetups() {
    		throw new Error("<MeetupGrid>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set meetups(value) {
    		throw new Error("<MeetupGrid>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* UI\TextInput.svelte generated by Svelte v3.49.0 */

    const file$3 = "UI\\TextInput.svelte";

    // (14:0) {:else}
    function create_else_block(ctx) {
    	let input;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "type", "text");
    			attr_dev(input, "id", /*id*/ ctx[1]);
    			input.value = /*value*/ ctx[4];
    			attr_dev(input, "class", "svelte-1i5mnz");
    			add_location(input, file$3, 14, 4, 320);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);

    			if (!mounted) {
    				dispose = listen_dev(input, "input", /*input_handler_1*/ ctx[6], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*id*/ 2) {
    				attr_dev(input, "id", /*id*/ ctx[1]);
    			}

    			if (dirty & /*value*/ 16 && input.value !== /*value*/ ctx[4]) {
    				prop_dev(input, "value", /*value*/ ctx[4]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(14:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (11:0) {#if  controlType ==="textarea"}
    function create_if_block(ctx) {
    	let textarea;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			textarea = element("textarea");
    			attr_dev(textarea, "id", /*id*/ ctx[1]);
    			attr_dev(textarea, "rows", /*rows*/ ctx[3]);
    			textarea.value = /*value*/ ctx[4];
    			attr_dev(textarea, "class", "svelte-1i5mnz");
    			add_location(textarea, file$3, 12, 4, 248);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, textarea, anchor);

    			if (!mounted) {
    				dispose = listen_dev(textarea, "input", /*input_handler*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*id*/ 2) {
    				attr_dev(textarea, "id", /*id*/ ctx[1]);
    			}

    			if (dirty & /*rows*/ 8) {
    				attr_dev(textarea, "rows", /*rows*/ ctx[3]);
    			}

    			if (dirty & /*value*/ 16) {
    				prop_dev(textarea, "value", /*value*/ ctx[4]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(textarea);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(11:0) {#if  controlType ===\\\"textarea\\\"}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div;
    	let label_1;
    	let t0;
    	let t1;

    	function select_block_type(ctx, dirty) {
    		if (/*controlType*/ ctx[0] === "textarea") return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			label_1 = element("label");
    			t0 = text(/*label*/ ctx[2]);
    			t1 = space();
    			if_block.c();
    			attr_dev(label_1, "for", /*id*/ ctx[1]);
    			attr_dev(label_1, "class", "svelte-1i5mnz");
    			add_location(label_1, file$3, 9, 4, 171);
    			attr_dev(div, "class", "form-control svelte-1i5mnz");
    			add_location(div, file$3, 8, 0, 139);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, label_1);
    			append_dev(label_1, t0);
    			append_dev(div, t1);
    			if_block.m(div, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*label*/ 4) set_data_dev(t0, /*label*/ ctx[2]);

    			if (dirty & /*id*/ 2) {
    				attr_dev(label_1, "for", /*id*/ ctx[1]);
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('TextInput', slots, []);
    	let { controlType } = $$props;
    	let { id } = $$props;
    	let { label } = $$props;
    	let { rows } = $$props;
    	let { value } = $$props;
    	const writable_props = ['controlType', 'id', 'label', 'rows', 'value'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<TextInput> was created with unknown prop '${key}'`);
    	});

    	function input_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	function input_handler_1(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ('controlType' in $$props) $$invalidate(0, controlType = $$props.controlType);
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    		if ('label' in $$props) $$invalidate(2, label = $$props.label);
    		if ('rows' in $$props) $$invalidate(3, rows = $$props.rows);
    		if ('value' in $$props) $$invalidate(4, value = $$props.value);
    	};

    	$$self.$capture_state = () => ({ controlType, id, label, rows, value });

    	$$self.$inject_state = $$props => {
    		if ('controlType' in $$props) $$invalidate(0, controlType = $$props.controlType);
    		if ('id' in $$props) $$invalidate(1, id = $$props.id);
    		if ('label' in $$props) $$invalidate(2, label = $$props.label);
    		if ('rows' in $$props) $$invalidate(3, rows = $$props.rows);
    		if ('value' in $$props) $$invalidate(4, value = $$props.value);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [controlType, id, label, rows, value, input_handler, input_handler_1];
    }

    class TextInput extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			controlType: 0,
    			id: 1,
    			label: 2,
    			rows: 3,
    			value: 4
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "TextInput",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*controlType*/ ctx[0] === undefined && !('controlType' in props)) {
    			console.warn("<TextInput> was created without expected prop 'controlType'");
    		}

    		if (/*id*/ ctx[1] === undefined && !('id' in props)) {
    			console.warn("<TextInput> was created without expected prop 'id'");
    		}

    		if (/*label*/ ctx[2] === undefined && !('label' in props)) {
    			console.warn("<TextInput> was created without expected prop 'label'");
    		}

    		if (/*rows*/ ctx[3] === undefined && !('rows' in props)) {
    			console.warn("<TextInput> was created without expected prop 'rows'");
    		}

    		if (/*value*/ ctx[4] === undefined && !('value' in props)) {
    			console.warn("<TextInput> was created without expected prop 'value'");
    		}
    	}

    	get controlType() {
    		throw new Error("<TextInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set controlType(value) {
    		throw new Error("<TextInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<TextInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<TextInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get label() {
    		throw new Error("<TextInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set label(value) {
    		throw new Error("<TextInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get rows() {
    		throw new Error("<TextInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rows(value) {
    		throw new Error("<TextInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<TextInput>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<TextInput>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* App.svelte generated by Svelte v3.49.0 */
    const file$4 = "App.svelte";

    function create_fragment$4(ctx) {
    	let header;
    	let t0;
    	let main;
    	let form;
    	let textinput0;
    	let t1;
    	let textinput1;
    	let t2;
    	let textinput2;
    	let t3;
    	let textinput3;
    	let t4;
    	let div0;
    	let label0;
    	let t6;
    	let input0;
    	let t7;
    	let div1;
    	let label1;
    	let t9;
    	let input1;
    	let t10;
    	let div2;
    	let label2;
    	let t12;
    	let input2;
    	let t13;
    	let div3;
    	let label3;
    	let t15;
    	let input3;
    	let t16;
    	let div4;
    	let label4;
    	let t18;
    	let input4;
    	let t19;
    	let div5;
    	let label5;
    	let t21;
    	let textarea;
    	let t22;
    	let button;
    	let t24;
    	let meetupgrid;
    	let current;
    	let mounted;
    	let dispose;
    	header = new Header({ $$inline: true });

    	textinput0 = new TextInput({
    			props: {
    				id: "title",
    				label: "Title",
    				value: /*title*/ ctx[0]
    			},
    			$$inline: true
    		});

    	textinput0.$on("input", /*input_handler*/ ctx[8]);

    	textinput1 = new TextInput({
    			props: {
    				id: "subtitle",
    				label: "SubTitle",
    				value: /*title*/ ctx[0]
    			},
    			$$inline: true
    		});

    	textinput1.$on("input", /*input_handler_1*/ ctx[9]);

    	textinput2 = new TextInput({
    			props: {
    				id: "title",
    				label: "Title",
    				value: /*title*/ ctx[0]
    			},
    			$$inline: true
    		});

    	textinput2.$on("input", /*input_handler_2*/ ctx[10]);

    	textinput3 = new TextInput({
    			props: {
    				id: "title",
    				label: "Title",
    				value: /*title*/ ctx[0]
    			},
    			$$inline: true
    		});

    	textinput3.$on("input", /*input_handler_3*/ ctx[11]);

    	meetupgrid = new MeetupGrid({
    			props: { meetups: /*meetUps*/ ctx[6] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(header.$$.fragment);
    			t0 = space();
    			main = element("main");
    			form = element("form");
    			create_component(textinput0.$$.fragment);
    			t1 = space();
    			create_component(textinput1.$$.fragment);
    			t2 = space();
    			create_component(textinput2.$$.fragment);
    			t3 = space();
    			create_component(textinput3.$$.fragment);
    			t4 = space();
    			div0 = element("div");
    			label0 = element("label");
    			label0.textContent = "Title";
    			t6 = space();
    			input0 = element("input");
    			t7 = space();
    			div1 = element("div");
    			label1 = element("label");
    			label1.textContent = "Subtitle";
    			t9 = space();
    			input1 = element("input");
    			t10 = space();
    			div2 = element("div");
    			label2 = element("label");
    			label2.textContent = "Address";
    			t12 = space();
    			input2 = element("input");
    			t13 = space();
    			div3 = element("div");
    			label3 = element("label");
    			label3.textContent = "Image Url";
    			t15 = space();
    			input3 = element("input");
    			t16 = space();
    			div4 = element("div");
    			label4 = element("label");
    			label4.textContent = "E-Mail";
    			t18 = space();
    			input4 = element("input");
    			t19 = space();
    			div5 = element("div");
    			label5 = element("label");
    			label5.textContent = "Description";
    			t21 = space();
    			textarea = element("textarea");
    			t22 = space();
    			button = element("button");
    			button.textContent = "Save";
    			t24 = space();
    			create_component(meetupgrid.$$.fragment);
    			attr_dev(label0, "for", "title");
    			add_location(label0, file$4, 61, 6, 2179);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "id", "title");
    			add_location(input0, file$4, 62, 6, 2219);
    			attr_dev(div0, "class", "form-control");
    			add_location(div0, file$4, 60, 4, 2145);
    			attr_dev(label1, "for", "subtitle");
    			add_location(label1, file$4, 65, 6, 2322);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "id", "subtitle");
    			add_location(input1, file$4, 66, 6, 2368);
    			attr_dev(div1, "class", "form-control");
    			add_location(div1, file$4, 64, 4, 2288);
    			attr_dev(label2, "for", "address");
    			add_location(label2, file$4, 69, 6, 2477);
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "id", "address");
    			add_location(input2, file$4, 70, 6, 2521);
    			attr_dev(div2, "class", "form-control");
    			add_location(div2, file$4, 68, 4, 2443);
    			attr_dev(label3, "for", "imageUrl");
    			add_location(label3, file$4, 73, 6, 2628);
    			attr_dev(input3, "type", "text");
    			attr_dev(input3, "id", "imageUrl");
    			add_location(input3, file$4, 74, 6, 2675);
    			attr_dev(div3, "class", "form-control");
    			add_location(div3, file$4, 72, 4, 2594);
    			attr_dev(label4, "for", "email");
    			add_location(label4, file$4, 77, 6, 2784);
    			attr_dev(input4, "type", "email");
    			attr_dev(input4, "id", "email");
    			add_location(input4, file$4, 78, 6, 2825);
    			attr_dev(div4, "class", "form-control");
    			add_location(div4, file$4, 76, 4, 2750);
    			attr_dev(label5, "for", "description");
    			add_location(label5, file$4, 81, 6, 2929);
    			attr_dev(textarea, "id", "description");
    			attr_dev(textarea, "rows", "3");
    			add_location(textarea, file$4, 82, 6, 2981);
    			attr_dev(div5, "class", "form-control");
    			add_location(div5, file$4, 80, 4, 2895);
    			attr_dev(button, "type", "submit");
    			add_location(button, file$4, 84, 4, 3062);
    			add_location(form, file$4, 54, 2, 1652);
    			attr_dev(main, "class", "svelte-1r5xu04");
    			add_location(main, file$4, 53, 0, 1642);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(header, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, main, anchor);
    			append_dev(main, form);
    			mount_component(textinput0, form, null);
    			append_dev(form, t1);
    			mount_component(textinput1, form, null);
    			append_dev(form, t2);
    			mount_component(textinput2, form, null);
    			append_dev(form, t3);
    			mount_component(textinput3, form, null);
    			append_dev(form, t4);
    			append_dev(form, div0);
    			append_dev(div0, label0);
    			append_dev(div0, t6);
    			append_dev(div0, input0);
    			set_input_value(input0, /*title*/ ctx[0]);
    			append_dev(form, t7);
    			append_dev(form, div1);
    			append_dev(div1, label1);
    			append_dev(div1, t9);
    			append_dev(div1, input1);
    			set_input_value(input1, /*subtitle*/ ctx[1]);
    			append_dev(form, t10);
    			append_dev(form, div2);
    			append_dev(div2, label2);
    			append_dev(div2, t12);
    			append_dev(div2, input2);
    			set_input_value(input2, /*address*/ ctx[2]);
    			append_dev(form, t13);
    			append_dev(form, div3);
    			append_dev(div3, label3);
    			append_dev(div3, t15);
    			append_dev(div3, input3);
    			set_input_value(input3, /*imageUrl*/ ctx[5]);
    			append_dev(form, t16);
    			append_dev(form, div4);
    			append_dev(div4, label4);
    			append_dev(div4, t18);
    			append_dev(div4, input4);
    			set_input_value(input4, /*email*/ ctx[3]);
    			append_dev(form, t19);
    			append_dev(form, div5);
    			append_dev(div5, label5);
    			append_dev(div5, t21);
    			append_dev(div5, textarea);
    			set_input_value(textarea, /*description*/ ctx[4]);
    			append_dev(form, t22);
    			append_dev(form, button);
    			append_dev(main, t24);
    			mount_component(meetupgrid, main, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[12]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[13]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[14]),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[15]),
    					listen_dev(input4, "input", /*input4_input_handler*/ ctx[16]),
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[17]),
    					listen_dev(form, "submit", prevent_default(/*addMeetup*/ ctx[7]), false, true, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const textinput0_changes = {};
    			if (dirty & /*title*/ 1) textinput0_changes.value = /*title*/ ctx[0];
    			textinput0.$set(textinput0_changes);
    			const textinput1_changes = {};
    			if (dirty & /*title*/ 1) textinput1_changes.value = /*title*/ ctx[0];
    			textinput1.$set(textinput1_changes);
    			const textinput2_changes = {};
    			if (dirty & /*title*/ 1) textinput2_changes.value = /*title*/ ctx[0];
    			textinput2.$set(textinput2_changes);
    			const textinput3_changes = {};
    			if (dirty & /*title*/ 1) textinput3_changes.value = /*title*/ ctx[0];
    			textinput3.$set(textinput3_changes);

    			if (dirty & /*title*/ 1 && input0.value !== /*title*/ ctx[0]) {
    				set_input_value(input0, /*title*/ ctx[0]);
    			}

    			if (dirty & /*subtitle*/ 2 && input1.value !== /*subtitle*/ ctx[1]) {
    				set_input_value(input1, /*subtitle*/ ctx[1]);
    			}

    			if (dirty & /*address*/ 4 && input2.value !== /*address*/ ctx[2]) {
    				set_input_value(input2, /*address*/ ctx[2]);
    			}

    			if (dirty & /*imageUrl*/ 32 && input3.value !== /*imageUrl*/ ctx[5]) {
    				set_input_value(input3, /*imageUrl*/ ctx[5]);
    			}

    			if (dirty & /*email*/ 8 && input4.value !== /*email*/ ctx[3]) {
    				set_input_value(input4, /*email*/ ctx[3]);
    			}

    			if (dirty & /*description*/ 16) {
    				set_input_value(textarea, /*description*/ ctx[4]);
    			}

    			const meetupgrid_changes = {};
    			if (dirty & /*meetUps*/ 64) meetupgrid_changes.meetups = /*meetUps*/ ctx[6];
    			meetupgrid.$set(meetupgrid_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(header.$$.fragment, local);
    			transition_in(textinput0.$$.fragment, local);
    			transition_in(textinput1.$$.fragment, local);
    			transition_in(textinput2.$$.fragment, local);
    			transition_in(textinput3.$$.fragment, local);
    			transition_in(meetupgrid.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(header.$$.fragment, local);
    			transition_out(textinput0.$$.fragment, local);
    			transition_out(textinput1.$$.fragment, local);
    			transition_out(textinput2.$$.fragment, local);
    			transition_out(textinput3.$$.fragment, local);
    			transition_out(meetupgrid.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(header, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(main);
    			destroy_component(textinput0);
    			destroy_component(textinput1);
    			destroy_component(textinput2);
    			destroy_component(textinput3);
    			destroy_component(meetupgrid);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let title = "";
    	let subtitle = "";
    	let address = "";
    	let email = "";
    	let description = "";
    	let imageUrl = "";

    	let meetUps = [
    		{
    			id: "m1",
    			title: "Coding Bootcamp",
    			subtitle: "Learn to code in 2 hours",
    			description: "In this meetup, we will have some experts that can teach you how to code",
    			imageUrl: "https://images.freeimages.com/images/large-previews/c43/home-1257617.jpg",
    			address: "27th Nerd Road, 48342 Michigan",
    			contactEmail: "code@test.com"
    		},
    		{
    			id: "m2",
    			title: "Swimming",
    			subtitle: "Let's go for a swim",
    			description: "In this meet up we will learn how to swim",
    			imageUrl: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxzZWFyY2h8NHx8cG9vbHxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=1000&q=60",
    			address: "27th Nerd Road, 48342 Michigan",
    			contactEmail: "swim@test.com"
    		}
    	];

    	function addMeetup() {
    		const newMeetup = {
    			id: Math.random().toString(),
    			title,
    			subtitle,
    			address,
    			description,
    			imageUrl,
    			contactEmail: email
    		};

    		//5.49 adding new meetups via a Form
    		// meetUps.push(newMeetup);// this will not work becasue sevelt does not reconzie this as a update
    		//do below
    		$$invalidate(6, meetUps = [...meetUps, newMeetup]);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const input_handler = e => $$invalidate(0, title = e.target.value);
    	const input_handler_1 = e => $$invalidate(0, title = e.target.value);
    	const input_handler_2 = e => $$invalidate(0, title = e.target.value);
    	const input_handler_3 = e => $$invalidate(0, title = e.target.value);

    	function input0_input_handler() {
    		title = this.value;
    		$$invalidate(0, title);
    	}

    	function input1_input_handler() {
    		subtitle = this.value;
    		$$invalidate(1, subtitle);
    	}

    	function input2_input_handler() {
    		address = this.value;
    		$$invalidate(2, address);
    	}

    	function input3_input_handler() {
    		imageUrl = this.value;
    		$$invalidate(5, imageUrl);
    	}

    	function input4_input_handler() {
    		email = this.value;
    		$$invalidate(3, email);
    	}

    	function textarea_input_handler() {
    		description = this.value;
    		$$invalidate(4, description);
    	}

    	$$self.$capture_state = () => ({
    		Header,
    		MeetupGrid,
    		TextInput,
    		title,
    		subtitle,
    		address,
    		email,
    		description,
    		imageUrl,
    		meetUps,
    		addMeetup
    	});

    	$$self.$inject_state = $$props => {
    		if ('title' in $$props) $$invalidate(0, title = $$props.title);
    		if ('subtitle' in $$props) $$invalidate(1, subtitle = $$props.subtitle);
    		if ('address' in $$props) $$invalidate(2, address = $$props.address);
    		if ('email' in $$props) $$invalidate(3, email = $$props.email);
    		if ('description' in $$props) $$invalidate(4, description = $$props.description);
    		if ('imageUrl' in $$props) $$invalidate(5, imageUrl = $$props.imageUrl);
    		if ('meetUps' in $$props) $$invalidate(6, meetUps = $$props.meetUps);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		title,
    		subtitle,
    		address,
    		email,
    		description,
    		imageUrl,
    		meetUps,
    		addMeetup,
    		input_handler,
    		input_handler_1,
    		input_handler_2,
    		input_handler_3,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler,
    		input4_input_handler,
    		textarea_input_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    const app = new App({
      target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
